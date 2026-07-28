import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const component = await readFile(
  new URL("../app/components/MealAnalysis.vue", import.meta.url),
  "utf8",
)

test("the dashboard shows Telegram-equivalent detected items before secondary metadata", () => {
  const items = component.indexOf("Detected items")
  const assumptions = component.indexOf("Notes and assumptions")
  const cost = component.indexOf("Analysis cost")

  assert.ok(items >= 0, "detected items section is missing")
  assert.ok(assumptions > items, "notes and assumptions should follow detected items")
  assert.ok(cost > assumptions, "analysis cost should remain secondary")
})
