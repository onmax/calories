import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { currentInputAttachments, defineAgent, resolveAttachmentData } from "vite-hub/agent";
import { audioBytes, cost, db, transcribe } from "vite-hub/agent/capabilities";
import { telegram } from "vite-hub/agent/channels";
import { blob } from "vite-hub/blob";
import { renderTemplate } from "#vitehub/templates";
import { useServerEnv } from "#vitehub/env/server";
import database, * as schema from "../../databases/config";

const caloriesOutput = v.object({
  text: v.pipe(v.string(), v.description("Concise Markdown response for the user")),
  mealId: v.optional(v.pipe(v.string(), v.description("Exact affected meal ID after a successful insert or update"))),
});

type CaloriesOutput = v.InferOutput<typeof caloriesOutput>;

function openRouter() {
  return createOpenRouter({ apiKey: useServerEnv().openrouter.apiKey });
}

function dashboardUrl(event: { runtime?: { request?: Request } }) {
  const origin = event.runtime?.request ? new URL(event.runtime.request.url).origin : undefined;
  return origin;
}

export default defineAgent({
  capabilities: [
    db({ mode: "write" }),
    cost(),
    transcribe({
      async execute({ audio }) {
        const { text } = await generateText({
          model: openRouter()("mistralai/voxtral-small-24b-2507"),
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Transcribe this audio exactly. Return only the transcript." },
              { type: "file", data: await audioBytes(audio), mediaType: audio.mediaType },
            ],
          }],
        });
        return text;
      },
    }),
  ],
  channels: {
    telegram: telegram({
      allowedUserIds: () => [useServerEnv().telegram.allowedUserId],
      botToken: () => useServerEnv().telegram.botToken,
      webhookSecret: () => useServerEnv().telegram.webhookSecret || false,
      messages: {
        concurrency: "queue",
        delivery: "manual",
        durable: true,
        fallbackStreamingPlaceholderText: "Thinking…",
        lockScope: "channel",
        triggerHistory: "none",
        timeout: 28_000,
      },
    }),
  },
  driver: {
    maxRetries: 0,
    model: () => openRouter()("z-ai/glm-5v-turbo", {
      usage: { include: true },
    }),
    output: { schema: caloriesOutput },
  },
  hooks: {
    "agent:error"(event) {
      console.error("[calories] Agent invocation failed", event.error);
      return event.reply("Sorry, I couldn't process that message.");
    },
    async "agent:finish"(event) {
      const usageCost = event.invocation.usage?.cost?.display ?? "Cost unavailable";
      const result = event.result as CaloriesOutput;
      const photos = currentInputAttachments(
        event.input.messages ?? [],
        event.invocation.run?.messageId,
      ).filter((part) => part.type === "image");

      if (result.mealId && photos.length) {
        const photoPath = `meals/${result.mealId}/original`;
        for (const [index, photo] of photos.entries()) {
          const body = await resolveAttachmentData(photo);
          if (!body) throw new Error("Telegram photo data was unavailable after analysis.");
          const pathname = index === 0 ? photoPath : `meals/${result.mealId}/photos/${index}`;
          const [storageError] = await blob.put(pathname, body, {
            access: "private",
            contentType: photo.mediaType,
          });
          if (storageError) throw storageError;
        }
        await database
          .update(schema.meals)
          .set({ photoPath })
          .where(eq(schema.meals.id, result.mealId));
      }

      if (result.mealId && usageCost !== "Cost unavailable") {
        try {
          await database
            .update(schema.meals)
            .set({ usageCost })
            .where(eq(schema.meals.id, result.mealId));
        } catch (error) {
          // A dashboard metric must never block the Telegram reply.
          console.error("[calories] Failed to record usage cost", error);
        }
      }
      return event.reply(await renderTemplate("reply", {
        cost: usageCost,
        dashboardUrl: dashboardUrl(event) ?? "",
        text: result.text,
      }));
    },
  },
});
