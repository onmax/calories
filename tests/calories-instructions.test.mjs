import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const instructions = await readFile(
  new URL("../server/agents/calories/instructions.md", import.meta.url),
  "utf8",
)
const agent = await readFile(
  new URL("../server/agents/calories/agent.ts", import.meta.url),
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

test("the meal prompt follows the current caption's consumed quantity", () => {
  assert.match(instructions, /current (?:message|caption)/i)
  assert.match(instructions, /ground truth/i)
  assert.match(instructions, /(?:ate|consumed)/i)
  assert.match(instructions, /photo differs.*stated quantity/i)
})

test("the meal prompt does not invent a protein identity", () => {
  assert.match(instructions, /uncertain protein/i)
  assert.match(instructions, /uncertain protein neutrally/i)
  assert.match(instructions, /low confidence/i)
})

test("each new meal is isolated while Telegram keeps enough history for follow-up questions", () => {
  assert.match(instructions, /Analyze only the current message/i)
  assert.match(instructions, /history never supplies items/i)
  assert.match(agent, /triggerHistory:\s*\{\s*maxMessages:\s*8,\s*source:\s*"thread"\s*\}/)
})

test("text descriptions can create meals without a photo", () => {
  assert.match(instructions, /with or without photos/i)
  assert.doesNotMatch(agent, /requires at least one image/i)
})

test("each distinct album photo produces its own meal analysis", () => {
  assert.match(instructions, /multiple photos.*exactly one analysis per photo/is)
  assert.match(instructions, /same order/i)
  assert.match(instructions, /separate consumed portion/i)
  assert.match(agent, /if \(images\.length > 1 && analyses\.length !== images\.length\)/)
})

test("explicit meal times are preserved in the user's time zone", () => {
  assert.match(instructions, /consumedAt/)
  assert.match(instructions, /ISO 8601 timestamp with an offset/i)
  assert.match(instructions, /explicit or relative time/i)
  assert.match(agent, /createdAt = analysis\.consumedAt/)
  assert.match(agent, /getUserTimeZone/)
})

test("journal questions and corrections use write-enabled ViteHub database access", () => {
  assert.match(instructions, /\*\*Edit:\*\*.*update only the matching row/is)
  assert.match(instructions, /\*\*Remove:\*\*.*delete the row only/is)
  assert.match(instructions, /Existing-data actions take priority over logging/i)
  assert.match(instructions, /kind: "reply".*never `kind: "meal"`/i)
  assert.match(agent, /db\(\{\s*mode:\s*"write"\s*\}\)/)
  assert.doesNotMatch(agent, /policy:/)
})

test("the persistent prompt stays compact", () => {
  const words = instructions.trim().split(/\s+/)
  assert.ok(words.length <= 350, `expected at most 350 words, received ${words.length}`)
})

test("the Agent Definition leaves Telegram and gateway construction to ViteHub", () => {
  assert.match(agent, /gateway\(model/)
  assert.match(agent, /telegram\(\{\s*allowedUserIds:/)
  assert.doesNotMatch(agent, /@ai-sdk\/gateway/)
  assert.doesNotMatch(agent, /@chat-adapter\/telegram/)
})

test("the Agent Definition uses ViteHub usage for persisted and Telegram costs", async () => {
  const reply = await readFile(
    new URL("../server/agents/calories/reply.md", import.meta.url),
    "utf8",
  )

  assert.match(agent, /import \{[^}]*\bdb\b[^}]*\busageCost\b[^}]*\} from "vite-hub\/agent\/capabilities"/)
  assert.match(agent, /usageCost\(\)/)
  assert.match(agent, /event\.extensions\.get\("usage-cost"\)/)
  assert.match(agent, /event\.reply\(`\$\{result\.text\}\\n\\n\$\{cost\}`\)/)
  assert.match(reply, /\{\{ cost \}\}/)
})
