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
  assert.match(instructions, /call `present_meal` with the complete row/);
  assert.match(schema, /totalProtein: integer\("total_protein"\)/);
  assert.match(schema, /usageCost: text\("usage_cost"\)/);
  assert.match(proteinMigration, /ALTER TABLE `meals` ADD `total_protein` integer/);
  assert.match(usageMigration, /ALTER TABLE `meals` ADD `usage_cost` text/);
  assert.doesNotMatch(agent, /output: \{ schema:/);
  assert.match(agent, /name: "present_meal"/);
  assert.match(agent, /currentInputAttachments/);
  assert.match(agent, /blob\.put\(pathname, body/);
  assert.match(agent, /photoPath,/);
  assert.doesNotMatch(instructions, /blob_edit/);
  assert.match(agent, /set\(\{ usageCost \}\)/);
  assert.match(api, /usageCost: schema\.meals\.usageCost/);
});

test("daily log uses theme controls and static meal details", async () => {
  const [header, mealAnalysis, page, rings] = await Promise.all([
    readFile(new URL("../app/components/AppHeader.vue", import.meta.url), "utf8"),
    readFile(new URL("../app/components/MealAnalysis.vue", import.meta.url), "utf8"),
    readFile(new URL("../app/pages/index.vue", import.meta.url), "utf8"),
    readFile(new URL("../app/components/NutritionRings.vue", import.meta.url), "utf8"),
  ]);

  assert.match(header, /UColorModeButton/);
  assert.match(header, /Daily goal/);
  assert.match(page, /expandedDays/);
  assert.match(page, /class="meal-preview"/);
  assert.match(page, /formatUsageCostUsd/);
  assert.match(mealAnalysis, /confidence-badge/);
  assert.doesNotMatch(mealAnalysis, /UTabs|aria-expanded|@toggle/);
  assert.doesNotMatch(rings, /ring-remaining/);
});
