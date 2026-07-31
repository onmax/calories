import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const component = await readFile(
  new URL("../app/components/MealAnalysis.vue", import.meta.url),
  "utf8",
)
const calendar = await readFile(
  new URL("../app/components/MonthOverview.vue", import.meta.url),
  "utf8",
)
const header = await readFile(
  new URL("../app/components/AppHeader.vue", import.meta.url),
  "utf8",
)
const styles = await readFile(
  new URL("../app/assets/main.css", import.meta.url),
  "utf8",
)

test("the dashboard keeps the meal breakdown and removes analysis cost", () => {
  assert.match(component, /What’s on the plate/)
  assert.match(component, /item\.portion/)
  assert.doesNotMatch(component, /Analysis cost/)
  assert.doesNotMatch(component, /formatUsageCost/)
})

test("meal titles wrap naturally instead of being line-clamped", () => {
  assert.match(styles, /\.analysis-heading h2\s*\{[^}]*overflow-wrap: break-word;[^}]*text-wrap: balance;/s)
  assert.doesNotMatch(styles, /-webkit-line-clamp/)
})

test("the app header replaces Telegram status with the month summary", () => {
  assert.doesNotMatch(header, /Telegram connected/)
  assert.doesNotMatch(header, /pendingCount/)
  assert.match(header, /class="header-month"/)
  assert.match(header, /<dt>Month<\/dt>/)
  assert.match(header, /<dt>Average<\/dt>/)
  assert.doesNotMatch(calendar, /food-calendar-heading/)
})

test("calendar days place their date and calories above the photo grid", () => {
  assert.match(calendar, /<UCalendar/)
  assert.match(calendar, /defineEmits<\{ select: \[key: string\] \}>/)
  assert.match(calendar, /<template #day="\{ day \}">/)
  assert.match(calendar, /class="day-summary"/)
  assert.match(calendar, /class="day-number tabular-nums"/)
  assert.match(calendar, /class="day-kcal"/)
  assert.match(calendar, /class="day-photo-grid"/)
  assert.doesNotMatch(calendar, /day-photo-shade/)
  assert.doesNotMatch(calendar, /day-calorie-total/)
  assert.match(styles, /\.food-calendar-cell\s*\{[^}]*aspect-ratio: 1;/s)
})

test("selecting a day exposes a large scrollable photo carousel above its analysis", () => {
  assert.match(component, /class="meal-carousel"/)
  assert.match(component, /photoMeals = computed/)
  assert.match(component, /v-for="dayMeal in photoMeals"/)
  assert.match(component, /@click="emit\('select', dayMeal\.id\)"/)
  assert.match(styles, /\.meal-carousel\s*\{[^}]*overflow-x: auto;[^}]*scroll-snap-type: x proximity;/s)
  assert.match(styles, /\.meal-carousel button\s*\{[^}]*position: relative;[^}]*aspect-ratio: 4 \/ 3;[^}]*width: clamp\(5\.5rem, 35%, 7\.5rem\);/s)
  assert.match(styles, /\.meal-carousel img\s*\{[^}]*position: absolute;[^}]*inset: 0;[^}]*object-fit: cover;/s)
})

test("the complete meal detail uses one compact internal scroller", () => {
  assert.match(component, /v-if="meal" :key="meal\.id" class="analysis-scroll"/)
  assert.match(component, /class="meal-summary"/)
  assert.match(component, /class="meal-carousel"/)
  assert.match(styles, /\.analysis-scroll\s*\{[^}]*overflow-y: auto;[^}]*overscroll-behavior-y: contain;/s)
  assert.match(styles, /\.meal-summary\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) auto;/s)
  assert.match(styles, /\.analysis-panel\s*\{[^}]*overflow: hidden;/s)
})

test("calendar selection gives immediate feedback and resets the detail surface", () => {
  assert.match(component, /:key="meal\.id" class="analysis-scroll"/)
  assert.match(styles, /\.food-calendar-trigger:active:not\(\[data-disabled\]\)\s*\{[^}]*transform: scale\(0\.98\);/s)
  assert.match(styles, /\.food-calendar-trigger:hover:not\(\[data-selected\]\):not\(\[data-disabled\]\)/)
  assert.match(styles, /@starting-style\s*\{\s*\.analysis-scroll\s*\{[^}]*opacity: 0\.72;/s)
})

test("the dashboard locks the document without hiding calendar content", () => {
  assert.match(styles, /html,\s*body,\s*#__nuxt\s*\{[^}]*overflow: hidden;/s)
  assert.match(styles, /\.calories-app\s*\{[^}]*height: 100dvh;[^}]*overflow: hidden;/s)
  assert.match(styles, /\.workspace\s*\{[^}]*overflow: clip;/s)
  assert.match(styles, /\.food-calendar-grid-body\s*\{[^}]*align-content: start;/s)
})
