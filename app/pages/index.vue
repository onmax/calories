<script setup lang="ts">
import type { Meal } from "~/utils/meal"

const { data, error, refresh, status } = await useFetch<{ costUsd: number, meals: Meal[] }>("/api/meals")
const route = useRoute()
const router = useRouter()
const selectedId = ref(typeof route.query.meal === "string" ? route.query.meal : undefined)

const meals = computed(() => data.value?.meals ?? [])
const costUsd = computed(() => data.value?.costUsd ?? 0)
const selectedMeal = computed(() => meals.value.find(meal => meal.id === selectedId.value) ?? meals.value[0])
const readyMeals = computed(() => meals.value.filter(meal => meal.status === "ready"))
const pendingMeals = computed(() => meals.value.filter(meal => ["received", "processing"].includes(meal.status)))

function dateKey(value: string | Date): string {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

const now = new Date()
const dailyCalorieGoal = 2_150
const dailyProteinGoal = 150
const todayKey = dateKey(now)
const todayMeals = computed(() => readyMeals.value.filter(meal => dateKey(meal.createdAt) === todayKey))
const todayCalories = computed(() => todayMeals.value.reduce((sum, meal) => sum + (meal.totalCalories ?? 0), 0))
const lastSevenDays = computed(() => {
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - offset))
    const key = dateKey(date)
    return {
      calories: readyMeals.value.filter(meal => dateKey(meal.createdAt) === key).reduce((sum, meal) => sum + (meal.totalCalories ?? 0), 0),
      isToday: key === todayKey,
      key,
      label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date),
    }
  })
  const max = Math.max(...days.map(day => day.calories), 1)
  return days.map(day => ({ ...day, height: day.calories ? Math.max(12, Math.round(day.calories / max * 100)) : 0 }))
})
const weekCalories = computed(() => lastSevenDays.value.reduce((sum, day) => sum + day.calories, 0))
const todayLabel = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" }).format(now)
const todayWeekday = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(now)

watch(meals, (next) => {
  if (!next.some(meal => meal.id === selectedId.value)) selectedId.value = next[0]?.id
}, { immediate: true })
watch(() => route.query.meal, (meal) => {
  if (typeof meal === "string") selectedId.value = meal
})

function selectMeal(id: string) {
  selectedId.value = id
  router.replace({ query: { ...route.query, meal: id } })
}

let refreshTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  refreshTimer = setInterval(() => {
    if (pendingMeals.value.length) refresh()
  }, 4_000)
})
onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <main class="calories-app">
    <AppHeader :loading="status === 'pending'" :pending-count="pendingMeals.length" @refresh="refresh()" />

    <div class="workspace">
      <section class="day-view">
        <header class="day-intro">
          <div class="day-heading">
            <p class="kicker">Food journal · {{ todayWeekday }}</p>
            <h1>{{ todayLabel }}</h1>
            <p>Every photo becomes a clear calorie estimate, with the uncertainty kept visible.</p>
          </div>
          <div class="day-total">
            <strong class="tabular-nums">{{ todayCalories.toLocaleString() }}</strong>
            <div>
              <span>kcal logged</span>
              <small>{{ dailyCalorieGoal.toLocaleString() }} kcal goal · {{ dailyProteinGoal }} g protein goal</small>
              <small>{{ todayMeals.length }} {{ todayMeals.length === 1 ? "meal" : "meals" }} today</small>
            </div>
          </div>
        </header>

        <WeekOverview :days="lastSevenDays" :total="weekCalories" :cost-usd="costUsd" />
        <MealStage :loading="status === 'pending'" :meal="selectedMeal" />
        <MealHistory :has-error="!!error" :loading="status === 'pending'" :meals="meals" :selected-id="selectedMeal?.id" @select="selectMeal" />
      </section>

      <MealAnalysis :meal="selectedMeal" />
    </div>
  </main>
</template>
