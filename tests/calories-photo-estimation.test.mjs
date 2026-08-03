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
const mealAnalysis = await readFile(
  new URL("../app/components/MealAnalysis.vue", import.meta.url),
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

test("each Telegram turn keeps its own webhook lifetime", () => {
  assert.match(agent, /concurrency:\s*"parallel"/);
  assert.doesNotMatch(agent, /concurrency:\s*"queue"/);
});

test("Telegram audio is transcribed before meal analysis", () => {
  assert.match(agent, /transcribe\(\(\)\s*=>/);
  assert.match(
    agent,
    /transcriptionModel\("openai\/gpt-4o-transcribe"\)/,
  );
  assert.match(
    instructions,
    /new meal described in text or transcribed audio.*return an `upsert`/is,
  );
});

test("the dashboard lets every meal be selected without requiring a photo", () => {
  assert.match(mealAnalysis, /v-for="dayMeal in meals"/);
  assert.match(mealAnalysis, /v-if="getMealPhotoUrl\(dayMeal\)"/);
  assert.match(mealAnalysis, /class="meal-carousel-fallback"/);
  assert.doesNotMatch(mealAnalysis, /const photoMeals/);
});

test("the primary model stays inside Telegram's background execution window", () => {
  assert.match(agent, /maxRetries:\s*0/);
  assert.match(agent, /gateway\("google\/gemini-3-flash"/);
  assert.match(
    agent,
    /fallbacks:\s*\["openai\/gpt-5\.4-mini",\s*"moonshotai\/kimi-k3"\]/,
  );
  assert.match(agent, /timeout:\s*28_000/);
});

test("structured output separates replies from meal mutations", () => {
  assert.match(agent, /z\.discriminatedUnion\("type"/);
  assert.match(agent, /type:\s*z\.literal\("reply"\)/);
  assert.match(agent, /type:\s*z\.literal\("upsert"\)/);
  assert.match(agent, /output:\s*\{ schema: caloriesOutputSchema \}/);
  assert.match(agent, /db\(\{ mode: "read" \}\)/);
  assert.doesNotMatch(agent, /db\(\{ mode: "write" \}\)/);
});

test("meal mutations persist before their success response is delivered", () => {
  assert.match(agent, /if \(output\.type === "upsert"\)/);
  assert.match(agent, /await database\.insert\(meals\).*onConflictDoUpdate/is);
  assert.match(agent, /onConflictDoUpdate\(\{[\s\S]*target: meals\.id/);
  assert.match(agent, /return event\.reply\(\[output\.text, cost\]/);
  assert.doesNotMatch(agent, /toolResults\.some/);
});

test("server failures only claim what was actually persisted", () => {
  assert.match(agent, /status\s*>=\s*500\s*&&\s*status\s*<\s*600/);
  assert.match(agent, /AI is temporarily unavailable/);
  assert.doesNotMatch(agent, /already in your dashboard/is);
});

test("photo persistence completes before a meal can be treated as logged", () => {
  assert.match(
    instructions,
    /new photo meal.*upload.*current input attachment.*before returning the `upsert`/is,
  );
  assert.match(
    instructions,
    /duplicate only when.*record is complete.*photo_path.*items.*total_calories/is,
  );
  assert.match(
    instructions,
    /incomplete.*repair.*current attachment.*returning an `upsert`.*without adding.*calories again/is,
  );
});

test("usage cost formatting stays inside the capability", () => {
  assert.match(agent, /usageCost\(\{\s*format:\s*"usd"\s*\}\)/);
  assert.match(agent, /invocation\.usage\?\.cost\?\.formatted/);
  assert.doesNotMatch(agent, /formatUsageCost|Intl\.NumberFormat/);
});
