import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("meal logging estimates and persists protein", async () => {
  const [instructions, schema, migration] = await Promise.all([
    readFile(new URL("../server/agents/calories/instructions.md", import.meta.url), "utf8"),
    readFile(new URL("../server/databases/config.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../server/databases/migrations/0002_add_meal_protein.sql", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(instructions, /estimate metric portions, calories, and protein/);
  assert.match(instructions, /`total_protein`/);
  assert.match(schema, /totalProtein: integer\("total_protein"\)/);
  assert.match(migration, /ALTER TABLE `meals` ADD `total_protein` integer/);
});
