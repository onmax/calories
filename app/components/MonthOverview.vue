<script setup lang="ts">
import { CalendarDate, type DateValue } from "@internationalized/date"
import { getMealPhotoUrl, type Meal } from "~/utils/meal"

const props = defineProps<{
  days: {
    calories: number
    dateLabel: string
    day: number
    isFuture: boolean
    isToday: boolean
    key: string
  }[]
  meals: Meal[]
  selectedKey?: string
}>()
const emit = defineEmits<{ select: [key: string] }>()

function dayLabel(day: typeof props.days[number]): string {
  return day.calories
    ? `${day.dateLabel}: ${day.calories.toLocaleString()} calories`
    : `${day.dateLabel}: no calories logged`
}

function keyFromCalendarDate(day: DateValue): string {
  return `${day.year}-${day.month - 1}-${day.day}`
}

function keyFromMeal(meal: Meal): string {
  const date = new Date(meal.createdAt)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

const selectedDate = computed(() => {
  const selected = props.days.find(day => day.key === props.selectedKey)
  if (!selected) return undefined
  const [year, month, day] = selected.key.split("-").map(Number)
  if (year === undefined || month === undefined || day === undefined) return undefined
  return new CalendarDate(year, month + 1, day)
})

function calendarDay(day: DateValue) {
  return props.days.find(item => item.key === keyFromCalendarDate(day))
}

function calendarDayLabel(day: DateValue): string | undefined {
  const item = calendarDay(day)
  return item ? dayLabel(item) : undefined
}

function dayMeals(day: DateValue): Meal[] {
  const key = keyFromCalendarDate(day)
  return props.meals.filter(meal => keyFromMeal(meal) === key)
}

function dayPhotos(day: DateValue): Meal[] {
  return dayMeals(day).filter(meal => getMealPhotoUrl(meal))
}

function photoGridStyle(day: DateValue) {
  const count = dayPhotos(day).length
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)))
  return {
    "--photo-columns": columns,
    "--photo-rows": Math.max(1, Math.ceil(count / columns)),
  }
}

function selectDate(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("year" in value)) return
  emit("select", keyFromCalendarDate(value as DateValue))
}
</script>

<template>
  <section class="month-overview" aria-label="Monthly calorie overview">
    <UCalendar
      class="food-calendar"
      color="neutral"
      fixed-weeks
      :is-date-disabled="day => !!calendarDay(day)?.isFuture"
      :model-value="selectedDate"
      :month-controls="false"
      :view-control="false"
      :year-controls="false"
      :ui="{
        body: 'food-calendar-body',
        cell: 'food-calendar-cell',
        cellTrigger: 'food-calendar-trigger',
        grid: 'food-calendar-grid',
        gridBody: 'food-calendar-grid-body',
        gridRow: 'food-calendar-row',
        gridWeekDaysRow: 'food-calendar-weekdays',
        headCell: 'food-calendar-weekday',
        header: 'food-calendar-header',
        root: 'food-calendar-root',
      }"
      variant="outline"
      :week-starts-on="1"
      weekday-format="short"
      @update:model-value="selectDate"
    >
      <template #week-day="{ day }">
        {{ day.slice(0, 1) }}
      </template>

      <template #day="{ day }">
        <span
          class="calendar-day-tile"
          :class="{ 'has-photos': dayPhotos(day).length, 'has-total': !!calendarDay(day)?.calories }"
          :aria-label="calendarDayLabel(day)"
        >
          <span class="day-summary">
            <span class="day-number tabular-nums">{{ day.day }}</span>
            <span v-if="calendarDay(day)?.calories" class="day-kcal">
              <strong class="tabular-nums">{{ calendarDay(day)?.calories.toLocaleString() }}</strong>
              <small>kcal</small>
            </span>
          </span>
          <span v-if="dayPhotos(day).length" class="day-photo-grid" :style="photoGridStyle(day)">
            <img
              v-for="meal in dayPhotos(day)"
              :key="meal.id"
              :src="getMealPhotoUrl(meal)"
              alt=""
              loading="lazy"
            >
          </span>
        </span>
      </template>
    </UCalendar>
  </section>
</template>
