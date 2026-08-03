import { createGateway } from "@ai-sdk/gateway";
import { defineAgent, gateway } from "vite-hub/agent";
import { blob, db, transcribe, usageCost } from "vite-hub/agent/capabilities";
import { useServerEnv } from "#vitehub/env/server";

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
    db({ mode: "write" }),
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
            ? "AI is temporarily unavailable. Try again in a minute, unless the meal is already in your dashboard."
            : "I couldn’t handle that. Please try again.";
        },
        fallbackStreamingPlaceholderText: "Thinking…",
        triggerHistory: "none",
        timeout: 25_000,
      },
    },
  },
  driver: {
    maxRetries: 0,
    model: gateway("moonshotai/kimi-k3", () => ({
      apiKey: useServerEnv().aiGateway.apiKey,
      fallbacks: ["google/gemini-3-flash", "openai/gpt-5.4-mini"],
    })),
  },
  hooks: {
    "agent:input"(context) {
      if (context.request) {
        context.context.set("dashboardUrl", new URL(context.request.url).origin);
      }
    },
    "agent:finish"(event) {
      const cost = event.invocation.usage?.cost?.formatted ?? "Cost unavailable";
      return event.reply([event.text, cost].filter(Boolean).join("\n\n"));
    },
  },
});
