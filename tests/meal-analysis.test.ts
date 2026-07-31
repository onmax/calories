import assert from "node:assert/strict"
import test from "node:test"
import { mealAnalysisSchema } from "../server/utils/meal-analysis.ts"

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
