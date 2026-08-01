import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const instructions = await readFile(
  new URL("../server/agents/calories/instructions.md", import.meta.url),
  "utf8",
);
const agent = await readFile(
  new URL("../server/agents/calories/agent.ts", import.meta.url),
  "utf8",
);

test("visible food photos are logged from visual estimates", () => {
  assert.match(
    instructions,
    /new (?:meal )?photo.*identify.*food.*estimate.*metric portion/is,
  );
  assert.match(
    instructions,
    /never ask.*identify the food.*portion size.*visual estimate/is,
  );
  assert.match(
    instructions,
    /ambiguous.*neutral.*best metric portion estimate.*low confidence/is,
  );
});

test("each photo analysis is isolated from prior meals", () => {
  assert.match(agent, /triggerHistory:\s*"none"/);
  assert.doesNotMatch(agent, /triggerHistory:\s*\{/);
});

test("photo persistence completes before a meal can be treated as logged", () => {
  assert.match(
    instructions,
    /new photo meal.*upload.*current input attachment.*before inserting/is,
  );
  assert.match(
    instructions,
    /duplicate only when.*record is complete.*photo_path.*items.*total_calories/is,
  );
  assert.match(
    instructions,
    /incomplete.*repair.*current attachment.*without adding.*calories again/is,
  );
});
