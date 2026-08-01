import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { renderMarkdownTemplate } from "vite-hub/markdown-template"

const instructions = await readFile(
  new URL("../server/agents/calories/instructions.md", import.meta.url),
  "utf8",
)
const agent = await readFile(
  new URL("../server/agents/calories/agent.ts", import.meta.url),
  "utf8",
)

test("the journal prompt keeps the current message authoritative", () => {
  assert.match(instructions, /current caption, consumed quantity, and stated time as ground truth/i)
  assert.match(instructions, /centered clear subject/i)
  assert.match(instructions, /ignore incidental background food/i)
})

test("prior-entry actions identify one database record before acting", () => {
  assert.match(instructions, /identify the record from the conversation and database/i)
  assert.match(instructions, /corrections, removals, and questions/i)
  assert.match(instructions, /ask one brief question.*ambiguous/i)
})

test("the four XML response templates each declare when they apply", () => {
  for (const name of ["duplicate", "new-meal", "journal-answer", "clarification"]) {
    assert.match(instructions, new RegExp(`<${name} use-when="[^"]+">`))
    assert.match(instructions, new RegExp(`</${name}>`))
  }
})

test("instruction composition resolves the dashboard URL but preserves the final cost binding", async () => {
  assert.equal(instructions.match(/\\\{\{ cost \}\}/g)?.length, 4)
  assert.doesNotMatch(instructions, /\\\\\{\{ cost \}\}/)

  const rendered = await renderMarkdownTemplate(instructions, {
    data: { context: { dashboardUrl: "https://calories.example" } },
  })

  assert.match(rendered, /https:\/\/calories\.example/)
  assert.match(rendered, /Dashboard: https:\/\/calories\.example\?meal=RECORD_ID/)
  assert.match(rendered, /TOTAL_CALORIES/)
  assert.doesNotMatch(rendered, /context\.dashboardUrl/)
  assert.match(rendered, /\{\{ cost \}\}/)
  assert.doesNotMatch(rendered, /\\\{\{ cost \}\}/)
  assert.doesNotMatch(instructions, /https?:\/\/[\w.-]*calor/i)
})

test("the Agent Definition delegates storage, cost, delivery, and rendering to ViteHub", () => {
  assert.match(agent, /db\(\{\s*mode:\s*"write"\s*\}\)/)
  assert.match(agent, /usageCost\(\{\s*format:\s*"usd"\s*\}\)/)
  assert.match(agent, /delivery:\s*"manual"/)
  assert.match(agent, /context\.context\.set\("dashboardUrl", useRequestURL\(\)\.origin\)/)
  assert.match(agent, /const cost = event\.extensions\.get\("usage-cost"\)\?\.cost\?\.formatted/)
  assert.match(agent, /return event\.reply\(await renderMarkdownTemplate\(event\.text \?\? "", \{ data: \{ cost \} \}\)\)/)
  assert.equal(agent.match(/event\.reply\(/g)?.length, 1)
})

test("the simplified Agent Definition has no domain output schema or local cost formatter", () => {
  assert.doesNotMatch(agent, /output:\s*\{\s*schema:/)
  assert.doesNotMatch(agent, /Intl\.NumberFormat/)
  assert.doesNotMatch(agent, /CaloriesAgentOutput|mealAnalysisOutput|formatUsageCost/)
})

test("the persistent prompt stays compact", () => {
  const words = instructions.trim().split(/\s+/)
  assert.ok(words.length <= 250, `expected at most 250 words, received ${words.length}`)
})
