import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { generateText } from "ai";
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { currentInputAttachments, defineAgent, defineCapability, resolveAttachmentData } from "vite-hub/agent";
import { audioBytes, db, transcribe, usage } from "vite-hub/agent/capabilities";
import { telegram } from "vite-hub/agent/channels";
import { blob } from "vite-hub/blob";
import { renderTemplate } from "#vitehub/templates";
import { useServerEnv } from "#vitehub/env/server";
import database, * as schema from "../../databases/config";

const mealDraftSchema = v.object({
  caption: v.pipe(v.string(), v.minLength(1)),
  confidence: v.picklist(["low", "medium", "high", "user-stated"]),
  createdAt: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  id: v.pipe(v.string(), v.minLength(1)),
  items: v.array(v.object({
    calories: v.pipe(v.number(), v.integer(), v.minValue(0)),
    name: v.pipe(v.string(), v.minLength(1)),
    portion: v.pipe(v.string(), v.minLength(1)),
    protein: v.pipe(v.number(), v.integer(), v.minValue(0)),
  })),
  totalCalories: v.pipe(v.number(), v.integer(), v.minValue(0)),
  totalProtein: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

const mealPresentationSchema = v.object({
  meal: mealDraftSchema,
});
const mealPresentationInputSchema = toStandardJsonSchema(mealPresentationSchema);

type MealPresentationResult = {
  approved: boolean;
  mealId?: string;
  reason?: string;
  text: string;
};

declare global {
  interface ViteHubAgentFinishExtensions {
    "meal-presentation": MealPresentationResult | undefined;
  }
}

function rejectedPresentation(reason: string): MealPresentationResult {
  return {
    approved: false,
    reason,
    text: "I couldn't verify and save that meal. Please resend it.",
  };
}

const mealPresentation = defineCapability({
  id: "meal-presentation",
  configure(context) {
    context.tools.add({
      present_meal: {
        name: "present_meal",
        description: "Validate and persist one complete meal. This is the only way to claim that a meal was saved.",
        inputSchema: mealPresentationInputSchema,
        async execute(input) {
          const previous = context.context.get<MealPresentationResult>("meal-presentation.result");
          if (previous) return previous;

          const proposal = v.safeParse(mealPresentationSchema, input);
          if (!proposal.success) {
            const result = rejectedPresentation("The proposed meal was incomplete.");
            context.context.set("meal-presentation.result", result);
            return result;
          }

          const { meal } = proposal.output;
          const itemCalories = meal.items.reduce((sum, item) => sum + item.calories, 0);
          const itemProtein = meal.items.reduce((sum, item) => sum + item.protein, 0);
          if (itemCalories !== meal.totalCalories || itemProtein !== meal.totalProtein) {
            const result = rejectedPresentation("The item totals did not equal the meal totals.");
            context.context.set("meal-presentation.result", result);
            return result;
          }

          const photos = currentInputAttachments(
            context.input.messages(),
            context.run?.messageId,
          ).filter((part) => part.type === "image");
          const photoPath = photos.length ? `meals/${meal.id}/original` : undefined;

          try {
            for (const [index, photo] of photos.entries()) {
              const body = await resolveAttachmentData(photo);
              if (!body) throw new Error("Telegram photo data was unavailable after analysis.");
              const pathname = index === 0 ? photoPath! : `meals/${meal.id}/photos/${index}`;
              const [storageError] = await blob.put(pathname, body, {
                access: "private",
                contentType: photo.mediaType,
              });
              if (storageError) throw storageError;
            }

            const createdAt = meal.createdAt === undefined ? undefined : new Date(meal.createdAt);
            await database.insert(schema.meals).values({
              ...meal,
              createdAt,
              photoPath,
            }).onConflictDoUpdate({
              set: {
                caption: meal.caption,
                confidence: meal.confidence,
                ...(createdAt ? { createdAt } : {}),
                items: meal.items,
                ...(photoPath ? { photoPath } : {}),
                totalCalories: meal.totalCalories,
                totalProtein: meal.totalProtein,
              },
              target: schema.meals.id,
            });
          } catch (error) {
            console.error("[calories] Meal presentation rejected during persistence", error);
            const result = rejectedPresentation("The database or photo store rejected the proposed meal.");
            context.context.set("meal-presentation.result", result);
            return result;
          }

          const result: MealPresentationResult = {
            approved: true,
            mealId: meal.id,
            text: "Meal saved, but I couldn't prepare the summary.",
          };
          context.context.set("meal-presentation.result", result);
          return result;
        },
      },
    });
    context.finish.provide(() => context.context.get<MealPresentationResult>("meal-presentation.result"));
  },
});

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
    mealPresentation,
    usage(),
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
    model: () => openRouter()("z-ai/glm-5v-turbo"),
  },
  hooks: {
    "agent:error"(event) {
      console.error("[calories] Agent invocation failed", event.error);
      const presentation = event.extensions.get("meal-presentation");
      if (presentation) return event.reply(presentation.text);
      return event.reply("Sorry, I couldn't process that message.");
    },
    async "agent:finish"(event) {
      const usageCost = event.invocation.usage?.cost?.display ?? "Cost unavailable";
      const presentation = event.extensions.get("meal-presentation");
      const text = presentation?.approved
        ? event.text ?? presentation.text
        : presentation?.text ?? event.text;

      if (presentation?.mealId && usageCost !== "Cost unavailable") {
        try {
          await database
            .update(schema.meals)
            .set({ usageCost })
            .where(eq(schema.meals.id, presentation.mealId));
        } catch (error) {
          // A dashboard metric must never block the Telegram reply.
          console.error("[calories] Failed to record usage cost", error);
        }
      }
      return event.reply(await renderTemplate("reply", {
        cost: usageCost,
        dashboardUrl: dashboardUrl(event) ?? "",
        text: text ?? "Done.",
      }));
    },
  },
});
