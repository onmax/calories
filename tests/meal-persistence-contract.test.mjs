import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("meal persistence completes in a tool instead of structured final output", async () => {
  const [agent, instructions] = await Promise.all([
    readFile(new URL("../server/agents/calories/agent.ts", import.meta.url), "utf8"),
    readFile(new URL("../server/agents/calories/instructions.md", import.meta.url), "utf8"),
  ]);

  assert.match(agent, /name:\s*"present_meal"/);
  assert.match(agent, /await database\.insert\(schema\.meals\).*onConflictDoUpdate/is);
  assert.match(agent, /approved:\s*true/);
  assert.doesNotMatch(agent, /driver:[\s\S]*output:\s*\{ schema:/);
  assert.match(instructions, /saved only when `present_meal` returns `approved: true`/i);
});
