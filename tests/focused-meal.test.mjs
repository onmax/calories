import assert from "node:assert/strict";
import test from "node:test";
import { copenhagenDayRange } from "../server/utils/copenhagen-day.ts";

test("focused Copenhagen days follow daylight saving time", () => {
  const spring = copenhagenDayRange(new Date("2026-03-29T12:00:00Z"));
  const autumn = copenhagenDayRange(new Date("2026-10-25T12:00:00Z"));

  assert.equal(spring[1].getTime() - spring[0].getTime(), 23 * 60 * 60 * 1_000);
  assert.equal(autumn[1].getTime() - autumn[0].getTime(), 25 * 60 * 60 * 1_000);
});
