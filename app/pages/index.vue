<script setup lang="ts">
import {
  formatMealTime,
  formatUsageCostUsd,
  getMealTitle,
  parseUsageCostUsd,
  type Meal,
  type MealsPage,
} from "~/utils/meal";

const route = useRoute();
const focusedMealId = typeof route.query.meal === "string" ? route.query.meal : undefined;
const { data, error: initialError } = await useFetch<MealsPage>("/api/meals", {
  query: focusedMealId ? { focus: focusedMealId } : undefined,
});
const meals = ref<Meal[]>(data.value?.meals ?? []);
const nextCursor = ref(data.value?.nextCursor);
const focusedMeal = focusedMealId
  ? meals.value.find((meal) => meal.id === focusedMealId)
  : undefined;
const expandedDays = ref(new Set(focusedMeal ? [dayKey(focusedMeal.createdAt)] : []));
const loading = ref(false);
const loadError = ref(initialError.value?.message);
const sentinel = useTemplateRef<HTMLElement>("sentinel");
const settingsOpen = ref(false);
const calorieGoal = ref(2_000);
const proteinGoal = ref(150);
let observer: IntersectionObserver | undefined;

function dayKey(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(value) === dayKey(today.toISOString())) return "Today";
  if (dayKey(value) === dayKey(yesterday.toISOString())) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date);
}

const days = computed(() => {
  const groups = new Map<
    string,
    {
      calories: number;
      cost: number;
      date: string;
      hasCost: boolean;
      meals: Meal[];
      protein: number;
    }
  >();
  for (const meal of meals.value) {
    const key = dayKey(meal.createdAt);
    const day = groups.get(key) ?? {
      calories: 0,
      cost: 0,
      date: meal.createdAt,
      hasCost: false,
      meals: [],
      protein: 0,
    };
    const cost = parseUsageCostUsd(meal.usageCost);
    day.meals.push(meal);
    day.calories += meal.totalCalories ?? 0;
    day.protein += meal.totalProtein ?? meal.items.reduce((sum, item) => sum + (item.protein ?? 0), 0);
    if (cost !== undefined) {
      day.cost += cost;
      day.hasCost = true;
    }
    groups.set(key, day);
  }
  return [...groups.entries()].map(([key, day]) => ({
    ...day,
    cost: day.hasCost ? day.cost : undefined,
    key,
    label: dayLabel(day.date),
  }));
});

async function loadMore() {
  if (loading.value || !nextCursor.value) return;
  loading.value = true;
  loadError.value = undefined;
  try {
    const page = await $fetch<MealsPage>("/api/meals", { query: { cursor: nextCursor.value } });
    const knownIds = new Set(meals.value.map((meal) => meal.id));
    meals.value.push(...page.meals.filter((meal) => !knownIds.has(meal.id)));
    nextCursor.value = page.nextCursor;
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "Could not load older meals";
  } finally {
    loading.value = false;
  }
}

function saveGoals() {
  calorieGoal.value = Math.max(1, Math.round(Number(calorieGoal.value) || 2_000));
  proteinGoal.value = Math.max(1, Math.round(Number(proteinGoal.value) || 150));
  localStorage.setItem(
    "calories-goals",
    JSON.stringify({ calories: calorieGoal.value, protein: proteinGoal.value }),
  );
  settingsOpen.value = false;
}

function toggleDay(key: string) {
  const next = new Set(expandedDays.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  expandedDays.value = next;
}

onMounted(() => {
  // ponytail: goals stay device-local until the dashboard has authentication.
  try {
    const goals = JSON.parse(localStorage.getItem("calories-goals") || "null");
    if (Number.isFinite(goals?.calories) && goals.calories > 0) calorieGoal.value = goals.calories;
    if (Number.isFinite(goals?.protein) && goals.protein > 0) proteinGoal.value = goals.protein;
  } catch {}

  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) void loadMore();
    },
    { rootMargin: "600px 0px" },
  );
  if (sentinel.value) observer.observe(sentinel.value);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <main class="calories-app">
    <AppHeader
      :calorie-goal="calorieGoal"
      :protein-goal="proteinGoal"
      :settings-open="settingsOpen"
      @settings="settingsOpen = !settingsOpen"
    />

    <form
      v-if="settingsOpen"
      id="goal-editor"
      class="goal-editor"
      aria-label="Daily goals"
      @submit.prevent="saveGoals"
    >
      <div>
        <label for="calorie-goal">Calories</label>
        <input
          id="calorie-goal"
          v-model.number="calorieGoal"
          inputmode="numeric"
          min="50"
          step="50"
          type="number"
        />
      </div>
      <div>
        <label for="protein-goal">Protein (g)</label>
        <input
          id="protein-goal"
          v-model.number="proteinGoal"
          inputmode="numeric"
          min="5"
          step="5"
          type="number"
        />
      </div>
      <button class="goal-save" type="submit">Save</button>
    </form>

    <div class="daily-log">
      <section
        v-for="day in days"
        :key="day.key"
        class="day-section"
        :class="{ 'is-open': expandedDays.has(day.key) }"
      >
        <header class="day-heading">
          <h2>{{ day.label }}</h2>
          <button
            class="day-toggle"
            type="button"
            :aria-expanded="expandedDays.has(day.key)"
            :aria-label="`${expandedDays.has(day.key) ? 'Hide' : 'Show'} ${day.meals.length} meals from ${day.label}`"
            @click="toggleDay(day.key)"
          >
            {{ day.meals.length }} {{ day.meals.length === 1 ? "meal" : "meals" }}
            <UIcon
              class="day-chevron"
              :class="{ 'is-expanded': expandedDays.has(day.key) }"
              name="i-lucide-chevron-down"
              aria-hidden="true"
            />
          </button>
        </header>

        <div class="day-layout">
          <div class="day-progress">
            <div class="day-ring">
              <NutritionRings
                :calorie-goal="calorieGoal"
                :calories="day.calories"
                :protein="day.protein"
                :protein-goal="proteinGoal"
              />
            </div>

            <dl class="day-metrics tabular-nums">
              <div>
                <dt><i class="calorie-dot" />Calories</dt>
                <dd><strong>{{ day.calories.toLocaleString() }}</strong> / {{ calorieGoal.toLocaleString() }} kcal</dd>
              </div>
              <div>
                <dt><i class="protein-dot" />Protein</dt>
                <dd><strong>{{ day.protein }}</strong> / {{ proteinGoal }} g</dd>
              </div>
              <div v-if="day.cost !== undefined" class="day-cost">
                <dt>AI cost</dt>
                <dd>{{ formatUsageCostUsd(day.cost) }}</dd>
              </div>
            </dl>
          </div>

          <div v-if="!expandedDays.has(day.key)" class="meal-preview">
            <div v-for="meal in day.meals.slice(0, 3)" :key="meal.id" class="meal-preview-item">
              <span class="meal-preview-photo"><MealPhoto :meal="meal" /></span>
              <span class="meal-preview-copy">
                <strong>{{ getMealTitle(meal) }}</strong>
                <span class="meal-preview-details">
                  <small>{{ formatMealTime(meal.createdAt) }}</small>
                  <span class="meal-preview-macros tabular-nums">
                    <span>{{ meal.totalCalories ?? 0 }} kcal</span>
                    <span>{{ meal.totalProtein ?? 0 }} g protein</span>
                  </span>
                </span>
              </span>
            </div>
            <span v-if="day.meals.length > 3" class="meal-preview-more">
              +{{ day.meals.length - 3 }} more {{ day.meals.length - 3 === 1 ? "meal" : "meals" }}
            </span>
          </div>

          <div v-else class="meal-list">
            <MealAnalysis v-for="meal in day.meals" :key="meal.id" :meal="meal" />
          </div>
        </div>
      </section>

      <div v-if="!focusedMealId" ref="sentinel" class="feed-sentinel" aria-live="polite">
        <span v-if="loading">Loading older meals…</span>
        <UButton v-else-if="loadError" color="error" variant="soft" @click="loadMore">
          Try again
        </UButton>
        <span v-else-if="!nextCursor">You’ve reached the first meal.</span>
      </div>
    </div>
  </main>
</template>
