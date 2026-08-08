import { createGateway } from "@ai-sdk/gateway";
import { defineAgent } from "vite-hub/agent";
import { blob, cost, db, transcribe } from "vite-hub/agent/capabilities";
import { telegram } from "vite-hub/agent/channels";
import { renderTemplate } from "#vitehub/templates";
import { useServerEnv } from "#vitehub/env/server";

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
  },
  hooks: {
    "agent:error"(event) {
      return event.reply("Sorry, I couldn't process that message.");
    },
    async "agent:finish"(event) {
      const usageCost = event.invocation.usage?.cost?.display ?? "Cost unavailable";
      return event.reply(await renderTemplate("reply", {
        cost: usageCost,
        dashboardUrl: dashboardUrl(event) ?? "",
        text: event.text ?? "",
      }));
    },
  },
});
