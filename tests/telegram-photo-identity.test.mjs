import assert from "node:assert/strict"
import test from "node:test"
import { telegram } from "vite-hub/agent/channels"

test("the ViteHub Telegram channel preserves file_unique_id on image parts", async () => {
  const channel = telegram({
    botToken: "test-token",
    mode: "webhook",
    userName: "test_bot",
  })
  assert.equal(typeof channel.adapter, "function")
  const adapter = await channel.adapter({})
  const message = adapter.parseMessage({
    chat: { id: 1, type: "private" },
    date: 1,
    from: { first_name: "Maxi", id: 1, is_bot: false },
    message_id: 1,
    photo: [{
      file_id: "downloadable-file-id",
      file_size: 100,
      file_unique_id: "stable-photo-id",
      height: 100,
      width: 100,
    }],
  })

  assert.deepEqual(message.attachments[0]?.fetchMetadata, {
    fileId: "downloadable-file-id",
    fileUniqueId: "stable-photo-id",
  })
})
