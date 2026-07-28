import assert from "node:assert/strict"
import test from "node:test"
import { getTelegramPhotoIdentity } from "../server/utils/meal-deduplication.ts"

test("resends share an identity even when Telegram rotates the downloadable file ID", () => {
  const first = getTelegramPhotoIdentity([{
    fetchMetadata: { fileId: "first-file", fileUniqueId: "same-photo" },
  }])
  const resend = getTelegramPhotoIdentity([{
    fetchMetadata: { fileId: "second-file", fileUniqueId: "same-photo" },
  }])

  assert.equal(first, "same-photo")
  assert.equal(resend, first)
})

test("a media group identity preserves every photo and its order", () => {
  assert.equal(
    getTelegramPhotoIdentity([
      { fetchMetadata: { fileUniqueId: "first" } },
      { fetchMetadata: { fileUniqueId: "second" } },
    ]),
    "first:second",
  )
})

test("old adapters without a unique ID do not produce a misleading identity", () => {
  assert.equal(
    getTelegramPhotoIdentity([{ fetchMetadata: { fileId: "temporary-file-id" } }]),
    undefined,
  )
})
