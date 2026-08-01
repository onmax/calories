import { defineAgent, gateway } from "vite-hub/agent";
import { blob, db, usageCost } from "vite-hub/agent/capabilities";
import { telegram } from "vite-hub/agent/channels";
import { renderMarkdownTemplate } from "vite-hub/markdown-template";
import { useServerEnv } from "#vitehub/env/server";

function formatUsageCost(
  cost: { amount: string; currency: string; estimated: boolean } | undefined,
) {
  if (!cost) return "Cost unavailable";
  const amount = Number(cost.amount);
  const fractionDigits = amount > 0 && amount < 0.01 ? 6 : 2;
  const value = Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", {
        currency: cost.currency,
        maximumFractionDigits: fractionDigits,
        minimumFractionDigits: fractionDigits,
        style: "currency",
      }).format(amount)
    : `${cost.currency} ${cost.amount}`;
  return `${cost.estimated ? "~" : ""}${value}`;
}

export default defineAgent({
  capabilities: [blob({ mode: "write" }), db({ mode: "write" }), usageCost()],
  channels: {
    telegram: telegram({
      allowedUserIds: () => [useServerEnv().telegram.allowedUserId],
      botToken: () => useServerEnv().telegram.botToken,
      messages: {
        concurrency: "queue",
        delivery: "manual",
        errorFallbackText: "I couldn’t handle that. Please try again.",
        fallbackStreamingPlaceholderText: "Thinking…",
        triggerHistory: { maxMessages: 8, source: "thread" },
        timeout: 25_000,
      },
      webhookSecret: () => useServerEnv().telegram.webhookSecret,
    }),
  },
  driver: {
    execution: {
      callSettings: { maxRetries: 2 },
    },
    model: gateway("zai/glm-5v-turbo", () => ({
      apiKey: useServerEnv().vercelAiGatewayToken,
    })),
  },
  hooks: {
    "agent:input"(context) {
      if (context.request) {
        context.context.set("dashboardUrl", new URL(context.request.url).origin);
      }
    },
    async "agent:finish"(event) {
      const cost = formatUsageCost(event.extensions.get("usage-cost")?.cost);
      return event.reply(
        await renderMarkdownTemplate("{{{ body }}}\n\n{{ cost }}", {
          data: { body: event.text ?? "", cost },
        }),
      );
    },
  },
});
