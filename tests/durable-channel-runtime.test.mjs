import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defineAgent } from "vite-hub/agent";
import { telegram } from "vite-hub/agent/channels";
import { createChannelWebhookRouteHandler } from "vite-hub/_internal/agent/server/internal";
import { resetWorkflowRuntime } from "vite-hub/_internal/workflow/runtime/state";
import { createLibsqlAgentState } from "vite-hub/agent/state/sqlite";

test("durable Telegram photos start a Cloudflare Workflow", async () => {
  const directory = await mkdtemp(join(tmpdir(), "calories-durable-channel-"));
  const state = createLibsqlAgentState({ url: `file:${join(directory, "state.db")}` });
  await state.connect();
  const originalFetch = globalThis.fetch;
  const originalCloudflareEnv = globalThis.__env__;
  const waitUntilTasks = [];
  let workflowPayload;

  globalThis.__env__ = {
    WORKFLOW_63616C6F72696573: {
      async create({ id, params }) {
        workflowPayload = params;
        return { id, status: async () => ({ status: "queued" }) };
      },
    },
  };

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/getMe")) return Response.json({ ok: true, result: { first_name: "Calories", id: 1, is_bot: true, username: "calories" } });
    if (url.includes("/getWebhookInfo")) return Response.json({ ok: true, result: { url: "https://example.test/webhooks/telegram" } });
    if (url.includes("/sendChatAction")) return Response.json({ ok: true, result: true });
    if (url.includes("/getFile")) return Response.json({ ok: true, result: { file_path: "photos/coffee.jpg" } });
    if (url.includes("/file/bot")) return new Response(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]));
    if (url.includes("/sendMessage") || url.includes("/sendRichMessage")) return Response.json({ ok: true, result: { chat: { id: 42 }, message_id: 1 } });
    throw new Error(`Unexpected Telegram request: ${url}`);
  };

  const agent = defineAgent({
    channels: {
      telegram: telegram({
        allowedUserIds: [42],
        botToken: "test-token",
        webhookSecret: false,
        messages: { delivery: "manual", state, timeout: 20, triggerHistory: "none" },
      }),
    },
    driver: {
      async run() {
        throw new Error("Agent ran inline instead of starting the Cloudflare Workflow");
      },
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
        caption: "Coffee",
        photo: [{ file_id: "coffee", file_size: 4, file_unique_id: "coffee-1", height: 1, width: 1 }],
      },
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  try {
    const response = await handler(request, "telegram", {
      agentName: "calories",
      capabilities: { blob: {}, db: {} },
      state,
      waitUntil: (task) => waitUntilTasks.push(task),
    });
    assert.equal(response.status, 200);
    await Promise.all(waitUntilTasks);
    assert.ok(workflowPayload, "photo invocation did not start a Workflow");
    assert.equal(workflowPayload.input.timeout, undefined);
    const workflowMessages = [workflowPayload.input.message, ...(workflowPayload.input.messages || [])].filter(Boolean);
    const image = workflowMessages.flatMap((message) => message.parts).find((part) => part.type === "image");
    assert.equal(image.data, "/9j/2Q==");
    assert.equal("fetchData" in image, false);
  } finally {
    resetWorkflowRuntime();
    if (originalCloudflareEnv === undefined) delete globalThis.__env__;
    else globalThis.__env__ = originalCloudflareEnv;
    globalThis.fetch = originalFetch;
    await state.disconnect();
    await rm(directory, { force: true, recursive: true });
  }
});
