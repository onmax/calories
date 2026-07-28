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
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
const monthStartOffset = (monthStart.getDay() + 6) % 7
const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long" }).format(now)
const monthDays = computed(() => {
  const dayCount = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), index + 1)
    const key = dateKey(date)
    const calories = readyMeals.value
      .filter(meal => dateKey(meal.createdAt) === key)
      .reduce((sum, meal) => sum + (meal.totalCalories ?? 0), 0)
    return {
      calories,
      dateLabel: new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(date),
      day: index + 1,
      isFuture: date > now,
      isToday: key === todayKey,
      key,
      overflow: Math.min(100, Math.max(0, calories - dailyCalorieGoal) / dailyCalorieGoal * 100),
      progress: Math.min(100, calories / dailyCalorieGoal * 100),
    }
  })
})
const monthCalories = computed(() => monthDays.value.reduce((sum, day) => sum + day.calories, 0))
const loggedMonthDays = computed(() => monthDays.value.filter(day => day.calories > 0).length)
const monthDailyAverage = computed(() => loggedMonthDays.value ? Math.round(monthCalories.value / loggedMonthDays.value) : 0)
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
    <AppHeader :pending-count="pendingMeals.length" />

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

        <MonthOverview
          :average="monthDailyAverage"
          :cost-usd="costUsd"
          :days="monthDays"
          :goal="dailyCalorieGoal"
          :month="monthLabel"
          :start-offset="monthStartOffset"
          :total="monthCalories"
        />
        <MealStage :loading="status === 'pending'" :meal="selectedMeal" />
        <MealHistory :has-error="!!error" :loading="status === 'pending'" :meals="meals" :selected-id="selectedMeal?.id" @select="selectMeal" />
      </section>

      <MealAnalysis :meal="selectedMeal" />
    </div>
  </main>
</template>
