import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("meal logging persists protein and exact usage cost", async () => {
  const [agent, api, instructions, proteinMigration, schema, usageMigration] = await Promise.all([
    readFile(new URL("../server/agents/calories/agent.ts", import.meta.url), "utf8"),
    readFile(new URL("../server/api/meals.get.ts", import.meta.url), "utf8"),
    readFile(new URL("../server/agents/calories/instructions.md", import.meta.url), "utf8"),
    readFile(
      new URL("../server/databases/migrations/0002_add_meal_protein.sql", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../server/databases/config.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../server/databases/migrations/0003_add_meal_usage_cost.sql", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(instructions, /estimate metric portions, calories, and protein/);
  assert.match(instructions, /`total_protein`/);
  assert.match(instructions, /set `mealId` to the exact inserted or updated row ID/);
  assert.match(schema, /totalProtein: integer\("total_protein"\)/);
  assert.match(schema, /usageCost: text\("usage_cost"\)/);
  assert.match(proteinMigration, /ALTER TABLE `meals` ADD `total_protein` integer/);
  assert.match(usageMigration, /ALTER TABLE `meals` ADD `usage_cost` text/);
  assert.match(agent, /output: \{ schema: caloriesOutput \}/);
  assert.match(agent, /set\(\{ usageCost \}\)/);
  assert.match(api, /usageCost: schema\.meals\.usageCost/);
});

test("daily log uses theme controls and collapsed photo strips", async () => {
  const [header, page, rings] = await Promise.all([
    readFile(new URL("../app/components/AppHeader.vue", import.meta.url), "utf8"),
    readFile(new URL("../app/pages/index.vue", import.meta.url), "utf8"),
    readFile(new URL("../app/components/NutritionRings.vue", import.meta.url), "utf8"),
  ]);

  assert.match(header, /UColorModeButton/);
  assert.match(header, />Goal</);
  assert.match(page, /expandedDays/);
  assert.match(page, /class="meal-strip"/);
  assert.doesNotMatch(rings, /ring-remaining/);
});
