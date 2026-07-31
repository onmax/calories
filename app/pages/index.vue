<script setup lang="ts">
import { getMealPhotoUrl, type Meal } from "~/utils/meal"

const { data, refresh } = await useFetch<{ costUsd: number, meals: Meal[] }>("/api/meals")
const route = useRoute()
const router = useRouter()
const selectedId = ref(typeof route.query.meal === "string" ? route.query.meal : undefined)
const selectedDayKey = ref(typeof route.query.day === "string" ? route.query.day : undefined)

const meals = computed(() => data.value?.meals ?? [])
const readyMeals = computed(() => meals.value.filter(meal => meal.status === "ready"))
const pendingMeals = computed(() => meals.value.filter(meal => ["received", "processing"].includes(meal.status)))

function dateKey(value: string | Date): string {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

const now = new Date()
const dailyProteinGoal = 150
const todayKey = dateKey(now)
const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(now)
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
    }
  })
})
const monthCalories = computed(() => monthDays.value.reduce((sum, day) => sum + day.calories, 0))
const loggedMonthDays = computed(() => monthDays.value.filter(day => day.calories > 0).length)
const monthDailyAverage = computed(() => loggedMonthDays.value ? Math.round(monthCalories.value / loggedMonthDays.value) : 0)
const selectedDayMeals = computed(() => meals.value.filter(meal => dateKey(meal.createdAt) === selectedDayKey.value))
const selectedDayCalories = computed(() => selectedDayMeals.value.reduce((sum, meal) => sum + (meal.totalCalories ?? 0), 0))
const selectedMeal = computed(() => selectedDayMeals.value.find(meal => meal.id === selectedId.value))

watch(meals, (next) => {
  const requestedMeal = next.find(meal => meal.id === selectedId.value)
  if (requestedMeal) selectedDayKey.value = dateKey(requestedMeal.createdAt)
  if (!selectedDayKey.value) selectedDayKey.value = todayKey
  const dayMeals = next.filter(meal => dateKey(meal.createdAt) === selectedDayKey.value)
  if (!dayMeals.some(meal => meal.id === selectedId.value)) {
    selectedId.value = dayMeals.find(meal => getMealPhotoUrl(meal))?.id ?? dayMeals[0]?.id
  }
}, { immediate: true })
watch(() => route.query.meal, (meal) => {
  if (typeof meal === "string") selectedId.value = meal
})

function selectDay(key: string) {
  selectedDayKey.value = key
  const dayMeals = meals.value.filter(meal => dateKey(meal.createdAt) === key)
  selectedId.value = dayMeals.find(meal => getMealPhotoUrl(meal))?.id ?? dayMeals[0]?.id
  router.replace({
    query: {
      day: key,
      ...(selectedId.value ? { meal: selectedId.value } : {}),
    },
  })
}

function selectMeal(id: string) {
  selectedId.value = id
  router.replace({ query: { day: selectedDayKey.value, meal: id } })
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
    <AppHeader
      :average="monthDailyAverage"
      :month-label="monthLabel"
      :total="monthCalories"
    />

    <div class="workspace">
      <section class="journal-pane">
        <MonthOverview
          :days="monthDays"
          :meals="meals"
          :selected-key="selectedDayKey"
          @select="selectDay"
        />
      </section>

      <MealAnalysis
        :day-calories="selectedDayCalories"
        :day-meal-count="selectedDayMeals.length"
        :meal="selectedMeal"
        :meals="selectedDayMeals"
        :protein-goal="dailyProteinGoal"
        :selected-id="selectedMeal?.id"
        @select="selectMeal"
      />
    </div>
  </main>
</template>
