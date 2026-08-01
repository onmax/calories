import assert from "node:assert/strict"
import test from "node:test"
import { completeAlbumAnalyses, isolateFirstAlbumImage } from "../server/utils/album-analysis.ts"
import { caloriesAgentOutputSchema, mealAnalysisSchema } from "../server/utils/meal-analysis.ts"

const meal = {
  assumptions: [],
  confidence: "high",
  items: [{ calories: 131, name: "meal", portion: "245 g" }],
  totalCalories: 131,
} as const

test("meal analysis accepts an explicit consumed time with an offset", () => {
  const consumedAt = "2026-07-29T19:30:00+07:00"
  assert.equal(mealAnalysisSchema.parse({ ...meal, consumedAt }).consumedAt, consumedAt)
})

test("meal analysis rejects an explicit consumed time without an offset", () => {
  assert.throws(() => mealAnalysisSchema.parse({
    ...meal,
    consumedAt: "2026-07-29T19:30:00",
  }))
})

test("meal output always contains an analyses array", () => {
  assert.equal(caloriesAgentOutputSchema.safeParse({ kind: "meal", analyses: meal }).success, false)
  assert.equal(caloriesAgentOutputSchema.safeParse({ kind: "meal", analyses: [meal] }).success, true)
})

test("an album runs one analysis call per image and preserves order", async () => {
  const images = [
    { mediaType: "image/jpeg", type: "image" as const, url: "https://example.com/first.jpg" },
    { mediaType: "image/jpeg", type: "image" as const, url: "https://example.com/second.jpg" },
  ]
  const message = { id: "telegram:191", parts: images, role: "user" as const }
  const album = isolateFirstAlbumImage([message], message.id)
  assert.ok(album)
  assert.deepEqual(message.parts, [images[0]])

  const calls = [images[0]!.url]
  const analyses = await completeAlbumAnalyses(meal, album, async (image) => {
    calls.push(image.url)
    return { ...meal, items: [{ ...meal.items[0], calories: 2 }], totalCalories: 2 }
  })

  assert.deepEqual(calls, ["https://example.com/first.jpg", "https://example.com/second.jpg"])
  assert.deepEqual(analyses.map(analysis => analysis.totalCalories), [131, 2])
})
