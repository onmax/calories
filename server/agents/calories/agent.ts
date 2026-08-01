import { defineAgent, gateway } from "vite-hub/agent"
import { db, usageCost } from "vite-hub/agent/capabilities"
import { telegram } from "vite-hub/agent/channels"
import { renderMarkdownTemplate } from "vite-hub/markdown-template"
import { useServerEnv } from "#vitehub/env/server"

export default defineAgent({
  capabilities: [
    db({ mode: "write" }),
    usageCost({ format: "usd" }),
  ],
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
        timeout: 50_000,
      },
      webhookSecret: () => useServerEnv().telegram.webhookSecret,
    }),
  },
  driver: {
    execution: {
      callSettings: { maxRetries: 5 },
    },
    model: gateway("zai/glm-5v-turbo", () => ({
      apiKey: useServerEnv().vercelAiGatewayToken,
    })),
  },
  hooks: {
    "agent:input"(context) {
      if (context.request) {
        context.context.set("dashboardUrl", new URL(context.request.url).origin)
      }
    },
    async "agent:finish"(event) {
      const cost = event.extensions.get("usage-cost")?.cost?.formatted ?? "Cost unavailable"
      return event.reply(await renderMarkdownTemplate(event.text ?? "", { data: { cost } }))
    },
  },
})
