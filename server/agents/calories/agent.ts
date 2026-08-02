import { defineAgent, gateway } from "vite-hub/agent";
import { blob, db, usageCost } from "vite-hub/agent/capabilities";
import { telegram } from "vite-hub/agent/channels";
import { renderMarkdownTemplate } from "vite-hub/markdown-template";
import { useServerEnv } from "#vitehub/env/server";

export default defineAgent({
  capabilities: [
    blob({ mode: "write" }),
    db({ mode: "write" }),
    usageCost({ format: "usd" }),
  ],
  channels: {
    telegram: telegram({
      allowedUserIds: () => [useServerEnv().telegram.allowedUserId],
      botToken: () => useServerEnv().telegram.botToken,
      messages: {
        concurrency: "parallel",
        delivery: "manual",
        errorFallbackText: "I couldn’t handle that. Please try again.",
        fallbackStreamingPlaceholderText: "Thinking…",
        triggerHistory: "none",
        timeout: 40_000,
      },
      webhookSecret: () => useServerEnv().telegram.webhookSecret,
    }),
  },
  driver: {
    execution: {
      callSettings: {
        maxRetries: 0,
        providerOptions: {
          gateway: {
            models: ["google/gemini-3-flash", "openai/gpt-5.4-mini"],
          },
        },
      },
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
      const cost =
        event.extensions.get("usage-cost")?.cost?.formatted ??
        "Cost unavailable";
      return event.reply(
        await renderMarkdownTemplate("{{{ body }}}\n\n{{ cost }}", {
          data: { body: event.text ?? "", cost },
        }),
      );
    },
  },
});
