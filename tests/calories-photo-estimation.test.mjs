import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveMealCreatedAt } from "../server/agents/calories/time.ts";

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

test("Telegram turns wait behind the active turn", () => {
  assert.match(agent, /concurrency:\s*"queue"/);
  assert.match(agent, /lockScope:\s*"channel"/);
  assert.doesNotMatch(agent, /concurrency:\s*"parallel"/);
});

test("Telegram audio is transcribed before meal analysis", () => {
  assert.match(agent, /transcribe\(\(\)\s*=>/);
  assert.match(
    agent,
    /transcriptionModel\("openai\/gpt-4o-transcribe"\)/,
  );
  assert.match(
    instructions,
    /new meal described in text or transcribed audio.*call `present_meal`/is,
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

test("the presentation tool separates replies from meal mutations", () => {
  assert.match(agent, /name:\s*"present_meal"/);
  assert.match(agent, /inputSchema:\s*mealPresentationSchema/);
  assert.match(instructions, /reply without a tool call/is);
  assert.doesNotMatch(agent, /output:\s*\{ schema:/);
  assert.match(agent, /db\(\{ mode: "read" \}\)/);
  assert.doesNotMatch(agent, /db\(\{ mode: "write" \}\)/);
});

test("the tool approves meal mutations only after persistence", () => {
  assert.match(agent, /await database\.insert\(meals\).*onConflictDoUpdate/is);
  assert.match(agent, /onConflictDoUpdate\(\{[\s\S]*target: meals\.id/);
  assert.match(agent, /if \(previous\?\.approved\) return previous/);
  assert.match(agent, /approved:\s*true/);
  assert.match(agent, /presentation\?\.approved.*event\.reply\(presentation\.text\)/s);
  assert.match(instructions, /saved only when the tool returns `approved: true`/is);
});

test("the presentation tool owns relative timestamps and meal links", () => {
  assert.match(agent, /resolveMealCreatedAt\(/);
  assert.match(agent, /dashboardUrl.*values\.id/s);
  assert.doesNotMatch(agent, /text:\s*z\.string\(\)\.min\(1\)/);
  assert.doesNotMatch(instructions, /put the rendered user-facing template in `text`/i);
});

test("last night is resolved from the Telegram message date", () => {
  assert.equal(
    resolveMealCreatedAt(
      "2025-05-13T18:50:00.000Z",
      "last night at 18:50 i had black beans and rice",
      "2026-08-04T14:06:00.000Z",
    ).toISOString(),
    "2026-08-03T18:50:00.000Z",
  );
});

test("Telegram identity is parsed from the adapter's composite message ID", () => {
  assert.match(agent, /compositeMessageId\?\.lastIndexOf\(":"\)/);
  assert.match(agent, /messageChatId !== telegramChatId/);
  assert.match(agent, /Number\.isSafeInteger\(telegramMessageId\)/);
});

test("server failures only claim what was actually persisted", () => {
  assert.match(agent, /status\s*>=\s*500\s*&&\s*status\s*<\s*600/);
  assert.match(agent, /AI is temporarily unavailable/);
  assert.doesNotMatch(agent, /already in your dashboard/is);
});

test("photo persistence completes before a meal can be treated as logged", () => {
  assert.match(
    instructions,
    /new photo meal.*upload.*current input attachment.*before calling `present_meal`/is,
  );
  assert.match(
    instructions,
    /duplicate only when.*record is complete.*photo_path.*items.*total_calories/is,
  );
  assert.match(
    instructions,
    /incomplete.*repair.*current attachment.*calling `present_meal`.*without adding.*calories again/is,
  );
});

test("usage cost formatting stays inside the capability", () => {
  assert.match(agent, /usageCost\(\{\s*format:\s*"usd"\s*\}\)/);
  assert.match(agent, /invocation\.usage\?\.cost\?\.formatted/);
  assert.doesNotMatch(agent, /formatUsageCost|Intl\.NumberFormat/);
});
