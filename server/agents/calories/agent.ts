import { defineAgent, gateway } from "vite-hub/agent";
import { blob, db, usageCost } from "vite-hub/agent/capabilities";
import { useServerEnv } from "#vitehub/env/server";

export default defineAgent({
  capabilities: [
    blob({ mode: "write" }),
    db({ mode: "write" }),
    usageCost({ format: "usd" }),
  ],
  channels: {
    telegram: {
      allowedUserIds: () => [useServerEnv().telegram.allowedUserId],
      messages: {
        concurrency: "parallel",
        delivery: "manual",
        errorFallbackText: "I couldn’t handle that. Please try again.",
        fallbackStreamingPlaceholderText: "Thinking…",
        triggerHistory: "none",
        timeout: 40_000,
      },
    },
  },
  driver: {
    maxRetries: 0,
    model: gateway("moonshotai/kimi-k3", {
      fallbacks: ["google/gemini-3-flash", "openai/gpt-5.4-mini"],
    }),
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
