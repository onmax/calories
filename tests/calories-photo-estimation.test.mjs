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
const replyTemplate = await readFile(
  new URL("../server/templates/reply.md", import.meta.url),
  "utf8",
);
const mealAnalysis = await readFile(
  new URL("../app/components/MealAnalysis.vue", import.meta.url),
  "utf8",
);
const database = await readFile(
  new URL("../server/databases/config.ts", import.meta.url),
  "utf8",
);

test("visible food photos are logged from visual estimates", () => {
  assert.match(instructions, /photos.*estimate metric portions/is);
  assert.match(instructions, /never ask for information.*visual estimate/is);
  assert.match(instructions, /low confidence.*ambiguous/is);
});

test("the Agent returns the model's Markdown directly", () => {
  assert.match(agent, /output: \{ schema: v\.string\(\) \}/);
  assert.match(agent, /text: event\.text \?\? ""/);
  assert.doesNotMatch(agent, /mealSchema|outputSchema|v\.variant|type: v\.literal/);
  assert.doesNotMatch(agent, /present_meal|defineCapability|toJsonSchema/);
  assert.doesNotMatch(instructions, /present_meal/);
});

test("Telegram turns use the ViteHub Channel and wait behind the active turn", () => {
  assert.match(agent, /import \{ telegram \} from "vite-hub\/agent\/channels"/);
  assert.match(agent, /telegram\(\{/);
  assert.match(agent, /concurrency: "queue"/);
  assert.match(agent, /lockScope: "channel"/);
  assert.match(agent, /triggerHistory: "none"/);
  assert.doesNotMatch(agent, /channels:\s*\{\s*telegram:\s*\{/);
});

test("Telegram audio is transcribed before the model responds", () => {
  assert.match(agent, /transcribe\(\(\)\s*=>/);
  assert.match(agent, /transcriptionModel\("openai\/gpt-4o-transcribe"\)/);
  assert.match(instructions, /text or transcribed audio.*photos/is);
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
  assert.match(agent, /"google\/gemini-2\.5-flash"/);
  assert.match(agent, /"google\/gemini-2\.5-flash-lite"/);
  assert.match(agent, /timeout: 28_000/);
});

test("the finish hook persists meals and renders the final reply", () => {
  assert.match(agent, /db\(\{ mode: "write" \}\)/);
  assert.match(agent, /renderTemplate\("reply"/);
  assert.match(agent, /event\.reply\(/);
  assert.match(instructions, /db_exec.*persist.*complete row/is);
  assert.match(instructions, /final concise Markdown response/is);
  assert.doesNotMatch(agent, /database\.insert|saveMeal|telegramIdentity/);
});

test("the finish hook owns timestamp and dashboard metadata", () => {
  assert.match(agent, /dashboardUrl\(event\)/);
  assert.match(agent, /event\.runtime\.request/);
  assert.doesNotMatch(agent, /useRequestURL|useRequestUrl/);
  assert.match(agent, /invocation\.usage\?\.cost\?\.formatted/);
  assert.match(instructions, /Omit `createdAt`.*current Telegram message time/is);
});

test("photo persistence still happens before the meal is reported", () => {
  assert.match(instructions, /upload a new attachment with `blob_edit`/i);
  assert.match(instructions, /repairing an incomplete duplicate/i);
  assert.match(instructions, /db_exec.*persist/is);
});

test("the meal schema is independent of Telegram identity", () => {
  assert.doesNotMatch(database, /telegram(Chat|Message|Photo)/);
  assert.doesNotMatch(database, /uniqueIndex/);
  assert.doesNotMatch(agent, /telegramIdentity|telegramChatId|telegramMessageId|telegramPhotoUniqueId/);
});

test("dynamic Markdown templates own the user-facing shape", () => {
  assert.match(replyTemplate, /\{\{\{ text \}\}\}/);
  assert.match(replyTemplate, /Dashboard: \{\{ dashboardUrl \}\}/);
  assert.match(replyTemplate, /\{\{ cost \}\}/);
});

test("server failures use ViteHub's shared fallback", () => {
  assert.doesNotMatch(agent, /errorStatus|errorFallbackText/);
  assert.doesNotMatch(agent, /already in your dashboard/is);
});
