import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defineAgent } from "vite-hub/agent";
import { telegram } from "vite-hub/agent/channels";
import { createChannelWebhookRouteHandler } from "vite-hub/_internal/agent/server/internal";
import { resetWorkflowRuntime, setWorkflowRuntimeConfig } from "vite-hub/_internal/workflow/runtime/state";
import { createLibsqlAgentState } from "vite-hub/agent/state/sqlite";

test("manual Telegram delivery is durable by default and drops the request deadline", async () => {
  const directory = await mkdtemp(join(tmpdir(), "calories-durable-channel-"));
  const state = createLibsqlAgentState({ url: `file:${join(directory, "state.db")}` });
  await state.connect();
  const originalFetch = globalThis.fetch;
  const waitUntilTasks = [];
  let release;
  let observedTimeout = "not-run";
  const blocked = new Promise((resolve) => {
    release = resolve;
  });

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/getMe")) return Response.json({ ok: true, result: { first_name: "Calories", id: 1, is_bot: true, username: "calories" } });
    if (url.includes("/getWebhookInfo")) return Response.json({ ok: true, result: { url: "https://example.test/webhooks/telegram" } });
    if (url.includes("/sendChatAction")) return Response.json({ ok: true, result: true });
    if (url.includes("/sendMessage") || url.includes("/sendRichMessage")) return Response.json({ ok: true, result: { chat: { id: 42 }, message_id: 1 } });
    throw new Error(`Unexpected Telegram request: ${url}`);
  };

  const agent = defineAgent({
    channels: {
      telegram: telegram({
        allowedUserIds: [42],
        botToken: "test-token",
        webhookSecret: false,
        messages: { delivery: "manual", state, timeout: 28_000, triggerHistory: "none" },
      }),
    },
    driver: {
      async run(context) {
        observedTimeout = context.input.timeout;
        await blocked;
        return { text: "internal output" };
      },
    },
    hooks: {
      "agent:finish": (event) => event.reply("Durable reply"),
    },
  });
  const handler = createChannelWebhookRouteHandler(agent);
  const request = new Request("https://example.test/webhooks/telegram", {
    body: JSON.stringify({
      update_id: 78,
      message: {
        chat: { id: 42, type: "private" },
        date: 1_754_000_000,
        from: { first_name: "Max", id: 42, is_bot: false },
        message_id: 103,
        text: "Coffee",
      },
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  setWorkflowRuntimeConfig({ provider: "vercel" });
  const handlerPromise = handler(request, "telegram", {
    agentName: "calories",
    capabilities: { blob: {}, db: {} },
    state,
    waitUntil: (task) => waitUntilTasks.push(task),
  });

  try {
    const response = await Promise.race([
      handlerPromise,
      new Promise((resolve) => setTimeout(() => resolve("blocked"), 50)),
    ]);
    assert.notEqual(response, "blocked", "webhook waited for Agent completion");
    assert.equal(response.status, 200);
    release();
    await Promise.all(waitUntilTasks);
    for (let attempt = 0; attempt < 50 && observedTimeout === "not-run"; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(observedTimeout, undefined);
  } finally {
    release();
    await handlerPromise.catch(() => {});
    resetWorkflowRuntime();
    globalThis.fetch = originalFetch;
    await state.disconnect();
    await rm(directory, { force: true, recursive: true });
  }
});
