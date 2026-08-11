import { createGateway } from "@ai-sdk/gateway";
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { defineAgent } from "vite-hub/agent";
import { blob, cost, db, transcribe } from "vite-hub/agent/capabilities";
import { telegram } from "vite-hub/agent/channels";
import { renderTemplate } from "#vitehub/templates";
import { useServerEnv } from "#vitehub/env/server";
import database, * as schema from "../../databases/config";

const caloriesOutput = v.object({
  text: v.pipe(v.string(), v.description("Concise Markdown response for the user")),
  mealId: v.optional(v.pipe(v.string(), v.description("Exact affected meal ID after a successful insert or update"))),
});

type CaloriesOutput = v.InferOutput<typeof caloriesOutput>;

function dashboardUrl(event: { runtime?: { request?: Request } }) {
  const origin = event.runtime?.request ? new URL(event.runtime.request.url).origin : undefined;
  return origin;
}

export default defineAgent({
  capabilities: [
    blob({ mode: "write" }),
    db({ mode: "write" }),
    transcribe(() => ({
      model: createGateway({
        apiKey: useServerEnv().aiGateway.apiKey,
      }).transcriptionModel("openai/gpt-4o-transcribe"),
    })),
    cost(),
  ],
  channels: {
    telegram: telegram({
      allowedUserIds: () => [useServerEnv().telegram.allowedUserId],
      botToken: () => useServerEnv().telegram.botToken,
      webhookSecret: () => useServerEnv().telegram.webhookSecret || false,
      messages: {
        concurrency: "queue",
        delivery: "manual",
        fallbackStreamingPlaceholderText: "Thinking…",
        lockScope: "channel",
        triggerHistory: "none",
        timeout: 28_000,
      },
    }),
  },
  driver: {
    maxRetries: 0,
    model: () => ({
      id: "zai/glm-5v-turbo",
      apiKey: useServerEnv().aiGateway.apiKey,
    }),
    output: { schema: caloriesOutput },
  },
  hooks: {
    "agent:error"(event) {
      return event.reply("Sorry, I couldn't process that message.");
    },
    async "agent:finish"(event) {
      const usageCost = event.invocation.usage?.cost?.display ?? "Cost unavailable";
      const result = event.result as CaloriesOutput;
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
