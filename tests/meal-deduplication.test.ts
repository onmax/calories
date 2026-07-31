import assert from "node:assert/strict"
import test from "node:test"
import { encode } from "jpeg-js"
import { getTelegramPhotoIdentity } from "../server/utils/meal-deduplication.ts"
import {
  createJpegPerceptualHash,
  createPerceptualHash,
} from "../server/utils/photo-perceptual-hash.ts"

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

test("text-only messages do not produce a photo identity", () => {
  assert.equal(getTelegramPhotoIdentity([]), undefined)
})

test("JPEG recompression preserves the visual identity", () => {
  const width = 64
  const height = 64
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4
      data[index] = x * 4
      data[index + 1] = y * 4
      data[index + 2] = (x + y) * 2
      data[index + 3] = 255
    }
  }

  const highQuality = encode({ data, width, height }, 90).data
  const recompressed = encode({ data, width, height }, 55).data

  assert.equal(
    createJpegPerceptualHash(highQuality),
    createJpegPerceptualHash(recompressed),
  )
})

test("different visual content produces a different identity", () => {
  const width = 8
  const height = 8
  const horizontal = new Uint8Array(width * height * 4)
  const vertical = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4
      horizontal.fill(x * 32, index, index + 3)
      vertical.fill(y * 32, index, index + 3)
      horizontal[index + 3] = 255
      vertical[index + 3] = 255
    }
  }

  assert.notEqual(
    createPerceptualHash({ data: horizontal, width, height }),
    createPerceptualHash({ data: vertical, width, height }),
  )
})
