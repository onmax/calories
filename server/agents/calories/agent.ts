import { createGateway } from "@ai-sdk/gateway";
import { defineAgent, gateway } from "vite-hub/agent";
import { blob, db, transcribe, usageCost } from "vite-hub/agent/capabilities";
import { telegram } from "vite-hub/agent/channels";
import { renderTemplate } from "#vitehub/templates";
import { useServerEnv } from "#vitehub/env/server";
import * as v from "valibot";

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
    usageCost({ format: "usd" }),
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
    model: gateway("google/gemini-3-flash", () => ({
      apiKey: useServerEnv().aiGateway.apiKey,
      fallbacks: [
        "google/gemini-2.5-flash",
        "google/gemini-2.5-flash-lite",
      ],
    })),
    output: { schema: v.string() },
  },
  hooks: {
    async "agent:finish"(event) {
      const cost = event.invocation.usage?.cost?.formatted ?? "Cost unavailable";
      return event.reply(await renderTemplate("reply", {
        cost,
        dashboardUrl: dashboardUrl(event) ?? "",
        text: event.text ?? "",
      }));
    },
  },
});
