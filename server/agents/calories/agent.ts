import { createGateway } from "@ai-sdk/gateway";
import { defineAgent, gateway } from "vite-hub/agent";
import { blob, db, transcribe, usageCost } from "vite-hub/agent/capabilities";
import { useServerEnv } from "#vitehub/env/server";
import { z } from "zod";
import database, { meals } from "../../databases/config";

const mealDraftSchema = z.object({
  caption: z.string().nullable(),
  confidence: z.enum(["low", "medium", "high"]).nullable(),
  createdAt: z.iso.datetime(),
  id: z.string().min(1),
  items: z.array(z.object({
    calories: z.number().int().nonnegative(),
    name: z.string().min(1),
    portion: z.string().min(1),
  })),
  photoPath: z.string().nullable(),
  totalCalories: z.number().int().nonnegative(),
});

const caloriesOutputSchema = z.discriminatedUnion("type", [
  z.object({
    text: z.string().min(1),
    type: z.literal("reply"),
  }),
  z.object({
    meal: mealDraftSchema,
    text: z.string().min(1),
    type: z.literal("upsert"),
  }),
]);

type CaloriesOutput = z.infer<typeof caloriesOutputSchema>;

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
        concurrency: "parallel",
        delivery: "manual",
        errorFallbackText: ({ error }) => {
          const status = errorStatus(error);
          return status !== undefined && status >= 500 && status < 600
            ? "AI is temporarily unavailable. Try again in a minute."
            : "I couldn’t handle that. Please try again.";
        },
        fallbackStreamingPlaceholderText: "Thinking…",
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
    output: { schema: caloriesOutputSchema },
  },
  hooks: {
    "agent:input"(context) {
      if (context.request) {
        context.context.set("dashboardUrl", new URL(context.request.url).origin);
      }
    },
    async "agent:finish"(event) {
      const output = event.result as CaloriesOutput;
      if (output.type === "upsert") {
        const run = event.invocation.run;
        const telegramChatId = run?.threadId?.replace(/^telegram:/, "");
        const telegramMessageId = Number(run?.messageId);
        if (!telegramChatId || !Number.isSafeInteger(telegramMessageId)) {
          throw new Error("A Telegram meal upsert requires its chat and message identity.");
        }

        const currentMessage = event.input.messages?.at(-1);
        const image = currentMessage?.parts.find(part => part.type === "image");
        const telegramPhotoUniqueId = image?.fetchMetadata?.fileId ?? null;
        const createdAt = new Date(output.meal.createdAt);
        const values = {
          ...output.meal,
          createdAt,
          telegramChatId,
          telegramMessageId,
          telegramPhotoUniqueId,
        };

        await database.insert(meals).values(values).onConflictDoUpdate({
          set: {
            caption: values.caption,
            confidence: values.confidence,
            createdAt,
            items: values.items,
            photoPath: values.photoPath,
            totalCalories: values.totalCalories,
          },
          target: meals.id,
        });
      }

      const cost = event.invocation.usage?.cost?.formatted ?? "Cost unavailable";
      return event.reply([output.text, cost].join("\n\n"));
    },
  },
});
