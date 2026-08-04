import { createGateway } from "@ai-sdk/gateway";
import { toJsonSchema } from "@valibot/to-json-schema";
import { defineAgent, defineCapability, gateway } from "vite-hub/agent";
import { blob, db, transcribe, usageCost } from "vite-hub/agent/capabilities";
import { useServerEnv } from "#vitehub/env/server";
import { and, gte, lt } from "drizzle-orm";
import * as v from "valibot";
import database, { meals } from "../../databases/config";

const mealDraftSchema = v.object({
  caption: v.nullable(v.string()),
  confidence: v.nullable(v.picklist(["low", "medium", "high"])),
  createdAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  id: v.pipe(v.string(), v.minLength(1)),
  items: v.array(v.object({
    calories: v.pipe(v.number(), v.integer(), v.minValue(0)),
    name: v.pipe(v.string(), v.minLength(1)),
    portion: v.pipe(v.string(), v.minLength(1)),
  })),
  photoPath: v.nullable(v.string()),
  totalCalories: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

const mealPresentationSchema = v.object({
  meal: mealDraftSchema,
});

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

function telegramIdentity(run: { messageId?: string; threadId?: string } | undefined) {
  const telegramChatId = run?.threadId?.match(/^telegram:(.+)$/)?.[1];
  const compositeMessageId = run?.messageId;
  const separator = compositeMessageId?.lastIndexOf(":") ?? -1;
  const messageChatId = separator > 0 ? compositeMessageId?.slice(0, separator) : undefined;
  const telegramMessageId = Number(compositeMessageId?.slice(separator + 1));

  if (!telegramChatId || messageChatId !== telegramChatId || !Number.isSafeInteger(telegramMessageId)) {
    return;
  }

  return { telegramChatId, telegramMessageId };
}

function rejectedPresentation(reason: string): MealPresentationResult {
  return {
    approved: false,
    reason,
    text: "I couldn’t verify and save that meal. Please resend it.",
  };
}

function mealPresentationText(meal: Omit<v.InferOutput<typeof mealDraftSchema>, "createdAt">, todayTotal: number, dashboardUrl: string): string {
  const items = meal.items
    .map(item => `- ${item.name}: ${item.portion}, ${item.calories} kcal`)
    .join("\n");
  return [
    `Logged **${meal.totalCalories} kcal**`,
    items,
    `Today: **${todayTotal} kcal**`,
    `Dashboard: ${dashboardUrl}?meal=${encodeURIComponent(meal.id)}`,
  ].join("\n\n");
}

const mealPresentation = defineCapability({
  id: "meal-presentation",
  configure(context) {
    context.tools.add({
      present_meal: {
        name: "Present meal",
        description: "Validate and save one complete meal. Include createdAt only when the user stated or implied a meal time different from the current Telegram message; otherwise omit it and the tool uses the message timestamp.",
        inputSchema: toJsonSchema(mealPresentationSchema),
        async execute(input) {
          const previous = context.context.get<MealPresentationResult>("meal-presentation.result");
          if (previous?.approved) return previous;

          const proposal = v.safeParse(mealPresentationSchema, input);
          if (!proposal.success) {
            const result = rejectedPresentation("The proposed meal was incomplete.");
            context.context.set("meal-presentation.result", result);
            return result;
          }

          const identity = telegramIdentity(context.run);
          if (!identity) {
            const result = rejectedPresentation("The Telegram chat and message identity could not be verified.");
            context.context.set("meal-presentation.result", result);
            return result;
          }

          const itemCalories = proposal.output.meal.items.reduce((sum, item) => sum + item.calories, 0);
          if (itemCalories !== proposal.output.meal.totalCalories) {
            const result = rejectedPresentation("The item calories did not equal the meal total.");
            context.context.set("meal-presentation.result", result);
            return result;
          }

          const values = {
            ...proposal.output.meal,
            ...identity,
            createdAt: new Date(
              proposal.output.meal.createdAt
              ?? context.context.get<string>("messageSentAt")
              ?? Date.now(),
            ),
            telegramPhotoUniqueId: context.context.get<string>("meal-presentation.photoUniqueId") ?? null,
          };
          const dashboardUrl = context.context.get<string>("dashboardUrl");
          if (!dashboardUrl) {
            const result = rejectedPresentation("The dashboard URL could not be verified.");
            context.context.set("meal-presentation.result", result);
            return result;
          }

          try {
            await database.insert(meals).values(values).onConflictDoUpdate({
              set: {
                caption: values.caption,
                confidence: values.confidence,
                createdAt: values.createdAt,
                items: values.items,
                photoPath: values.photoPath,
                telegramChatId: values.telegramChatId,
                telegramMessageId: values.telegramMessageId,
                telegramPhotoUniqueId: values.telegramPhotoUniqueId,
                totalCalories: values.totalCalories,
              },
              target: meals.id,
            });
          }
          catch (error) {
            console.error("[calories] Meal presentation rejected during persistence", error);
            const result = rejectedPresentation("The database rejected the proposed meal.");
            context.context.set("meal-presentation.result", result);
            return result;
          }

          const dayStart = new Date(values.createdAt);
          dayStart.setUTCHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart);
          dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
          const dayMeals = await database
            .select({ totalCalories: meals.totalCalories })
            .from(meals)
            .where(and(gte(meals.createdAt, dayStart), lt(meals.createdAt, dayEnd)));
          const todayTotal = dayMeals.reduce((sum, meal) => sum + (meal.totalCalories ?? 0), 0);

          const result: MealPresentationResult = {
            approved: true,
            mealId: values.id,
            text: mealPresentationText(values, todayTotal, dashboardUrl),
          };
          context.context.set("meal-presentation.result", result);
          return result;
        },
      },
    });
    context.finish.provide(() => context.context.get<MealPresentationResult>("meal-presentation.result"));
  },
});

function errorStatus(error: unknown): number | undefined {
  const seen = new Set<object>();
  let current = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const failure = current as {
      cause?: unknown;
      response?: { status?: unknown };
      status?: unknown;
      statusCode?: unknown;
    };
    const status = typeof failure.statusCode === "number"
      ? failure.statusCode
      : typeof failure.status === "number"
        ? failure.status
        : typeof failure.response?.status === "number"
          ? failure.response.status
          : undefined;

    if (status !== undefined) return status;
    current = failure.cause;
  }
}

export default defineAgent({
  capabilities: [
    blob({ mode: "write" }),
    db({ mode: "read" }),
    mealPresentation,
    transcribe(() => ({
      model: createGateway({
        apiKey: useServerEnv().aiGateway.apiKey,
      }).transcriptionModel("openai/gpt-4o-transcribe"),
    })),
    usageCost({ format: "usd" }),
  ],
  channels: {
    telegram: {
      allowedUserIds: () => [useServerEnv().telegram.allowedUserId],
      botToken: () => useServerEnv().telegram.botToken,
      webhookSecret: () => useServerEnv().telegram.webhookSecret || false,
      messages: {
        concurrency: "queue",
        delivery: "manual",
        errorFallbackText: ({ error }) => {
          const status = errorStatus(error);
          return status !== undefined && status >= 500 && status < 600
            ? "AI is temporarily unavailable. Try again in a minute."
            : "I couldn’t handle that. Please try again.";
        },
        fallbackStreamingPlaceholderText: "Thinking…",
        lockScope: "channel",
        triggerHistory: "none",
        timeout: 28_000,
      },
    },
  },
  driver: {
    maxRetries: 0,
    model: gateway("google/gemini-3-flash", () => ({
      apiKey: useServerEnv().aiGateway.apiKey,
      fallbacks: ["openai/gpt-5.4-mini", "moonshotai/kimi-k3"],
    })),
  },
  hooks: {
    "agent:input"(context) {
      if (context.request) {
        context.context.set("dashboardUrl", new URL(context.request.url).origin);
      }
      const currentMessage = context.input.messages?.at(-1);
      if (currentMessage?.createdAt) {
        context.context.set("messageSentAt", currentMessage.createdAt);
        context.context.set("journalTimezone", "Europe/Copenhagen");
      }
      const image = currentMessage?.parts.find(part => part.type === "image");
      if (image?.fetchMetadata?.fileId) {
        context.context.set("meal-presentation.photoUniqueId", image.fetchMetadata.fileId);
      }
    },
    "agent:error"(event) {
      const presentation = event.extensions.get("meal-presentation");
      if (presentation?.approved) return event.reply(presentation.text);
    },
    "agent:finish"(event) {
      const presentation = event.extensions.get("meal-presentation");
      const text = presentation?.text ?? event.text;
      const cost = event.invocation.usage?.cost?.formatted ?? "Cost unavailable";
      return event.reply([text, cost].filter(Boolean).join("\n\n"));
    },
  },
});
