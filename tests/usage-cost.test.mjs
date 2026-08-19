import assert from "node:assert/strict";
import test from "node:test";
import { formatUsageCostUsd, parseUsageCostUsd } from "../app/utils/meal.ts";

test("parses and totals formatted USD usage costs", () => {
  const costs = ["$0.0042", "US$0.0011", "Cost unavailable"]
    .map(parseUsageCostUsd)
    .filter((cost) => cost !== undefined);

  assert.deepEqual(costs, [0.0042, 0.0011]);
  assert.equal(formatUsageCostUsd(costs.reduce((sum, cost) => sum + cost, 0)), "$0.0053");
});
