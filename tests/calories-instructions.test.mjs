import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const instructions = await readFile(
  new URL("../server/agents/calories/instructions.md", import.meta.url),
  "utf8",
)

test("the meal prompt prioritizes the clear main subject over background dishes", () => {
  assert.match(instructions, /main subject/i)
  assert.match(instructions, /background/i)
  assert.match(instructions, /center/i)
})

test("the meal prompt keeps clear unsweetened Japanese green tea within 0 to 5 kcal", () => {
  assert.match(instructions, /Japanese green tea/i)
  assert.match(instructions, /0(?:\s|–|-)+5 kcal/i)
  assert.match(instructions, /without milk/i)
})
