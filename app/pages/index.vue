<script setup lang="ts">
import type { Meal, MealsPage } from "~/utils/meal";

const { data, error: initialError } = await useFetch<MealsPage>("/api/meals");
const meals = ref<Meal[]>(data.value?.meals ?? []);
const nextCursor = ref(data.value?.nextCursor);
const selectedId = ref<string>();
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
  const groups = new Map<string, { calories: number; date: string; meals: Meal[]; protein: number }>();
  for (const meal of meals.value) {
    const key = dayKey(meal.createdAt);
    const day = groups.get(key) ?? { calories: 0, date: meal.createdAt, meals: [], protein: 0 };
    day.meals.push(meal);
    day.calories += meal.totalCalories ?? 0;
    day.protein += meal.totalProtein ?? meal.items.reduce((sum, item) => sum + (item.protein ?? 0), 0);
    groups.set(key, day);
  }
  return [...groups.entries()].map(([key, day]) => ({ ...day, key, label: dayLabel(day.date) }));
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

    <section v-if="settingsOpen" class="goal-editor" aria-label="Daily goals">
      <div>
        <label for="calorie-goal">Calories</label>
        <UInputNumber id="calorie-goal" v-model="calorieGoal" :min="50" :step="50" />
      </div>
      <div>
        <label for="protein-goal">Protein (g)</label>
        <UInputNumber id="protein-goal" v-model="proteinGoal" :min="5" :step="5" />
      </div>
      <UButton color="neutral" @click="saveGoals">Save goals</UButton>
    </section>

    <div class="daily-log">
      <section v-for="day in days" :key="day.key" class="day-section">
        <aside class="day-summary">
          <header>
            <span>{{ day.label }}</span>
            <strong>{{ day.meals.length }} {{ day.meals.length === 1 ? "meal" : "meals" }}</strong>
          </header>
          <NutritionRings
            :calorie-goal="calorieGoal"
            :calories="day.calories"
            :protein="day.protein"
            :protein-goal="proteinGoal"
          />
        </aside>

        <div class="meal-list">
          <MealAnalysis
            v-for="meal in day.meals"
            :key="meal.id"
            :expanded="selectedId === meal.id"
            :meal="meal"
            @toggle="selectedId = selectedId === meal.id ? undefined : meal.id"
          />
        </div>
      </section>

      <div ref="sentinel" class="feed-sentinel" aria-live="polite">
        <span v-if="loading">Loading older meals…</span>
        <UButton v-else-if="loadError" color="error" variant="soft" @click="loadMore">
          Try again
        </UButton>
        <span v-else-if="!nextCursor">You’ve reached the first meal.</span>
      </div>
    </div>
  </main>
</template>
