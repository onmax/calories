import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defineAgent } from "vite-hub/agent";
import { telegram } from "vite-hub/agent/channels";
import { createChannelWebhookRouteHandler } from "vite-hub/_internal/agent/server/internal";
import { createLibsqlAgentState } from "vite-hub/agent/state/sqlite";

test("Telegram replies include the original photo and duplicate updates run once", async () => {
  const directory = await mkdtemp(join(tmpdir(), "calories-telegram-"));
  const state = createLibsqlAgentState({ url: `file:${join(directory, "state.db")}` });
  const originalFetch = globalThis.fetch;
  const invocations = [];

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/getMe")) {
      return Response.json({ ok: true, result: { first_name: "Calories", id: 1, is_bot: true, username: "calories" } });
    }
    if (url.includes("/getWebhookInfo")) {
      return Response.json({ ok: true, result: { url: "https://example.test/webhooks/telegram" } });
    }
    if (url.includes("/sendChatAction")) return Response.json({ ok: true, result: true });
    if (url.includes("/getFile")) return Response.json({ ok: true, result: { file_path: "photos/coffee.jpg" } });
    if (url.includes("/file/bot")) return new Response(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]));
    throw new Error(`Unexpected Telegram request: ${url}`);
  };

  try {
    const agent = defineAgent({
      channels: {
        telegram: telegram({
          allowedUserIds: [42],
          botToken: "test-token",
          webhookSecret: false,
          messages: { delivery: "manual", state, triggerHistory: "none" },
        }),
      },
      driver: {
        async run(context) {
          const message = context.messages[0];
          const image = message.parts.find((part) => part.type === "image");
          invocations.push({ bytes: new Uint8Array(await image.fetchData()), message });
          return { text: "ok" };
        },
      },
    });
    const handler = createChannelWebhookRouteHandler(agent);
    const payload = {
      update_id: 77,
      message: {
        chat: { id: 42, type: "private" },
        date: 1_754_000_000,
        from: { first_name: "Max", id: 42, is_bot: false },
        message_id: 102,
        reply_to_message: {
          caption: "Coffee with milk",
          chat: { id: 42, type: "private" },
          date: 1_753_000_000,
          from: { first_name: "Max", id: 42, is_bot: false },
          message_id: 19,
          photo: [{ file_id: "coffee", file_size: 4, file_unique_id: "coffee-1", height: 1, width: 1 }],
        },
        text: "I took it at 10",
      },
    };
    const request = () => new Request("https://example.test/webhooks/telegram", {
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const waitFor = async (responsePromise) => {
      const pending = [];
      const response = await responsePromise(pending);
      assert.equal(response.status, 200);
      await Promise.all(pending);
    };

    await waitFor((pending) => handler(request(), "telegram", { agentName: "calories", state, waitUntil: (task) => pending.push(task) }));
    await waitFor((pending) => handler(request(), "telegram", { agentName: "calories", state, waitUntil: (task) => pending.push(task) }));

    assert.equal(invocations.length, 1);
    assert.deepEqual([...invocations[0].bytes], [0xff, 0xd8, 0xff, 0xd9]);
    assert.equal(invocations[0].message.parts.map((part) => part.text || "").join(""), "<reply_to_message>\nCoffee with milk\n</reply_to_message>\n<user_message>\nI took it at 10\n</user_message>");
    assert.deepEqual(invocations[0].message.metadata.chat.replyTo, {
      attachmentCount: 1,
      author: { fullName: "Max", isBot: false, userId: "42", userName: "Max" },
      dateSent: "2025-07-20T08:26:40.000Z",
      messageId: "42:19",
      text: "Coffee with milk",
    });
  } finally {
    globalThis.fetch = originalFetch;
    await state.disconnect();
    await rm(directory, { force: true, recursive: true });
  }
});
