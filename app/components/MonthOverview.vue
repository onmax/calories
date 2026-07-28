<script setup lang="ts">
import { formatUsd } from "~/utils/usage"

const props = defineProps<{
  average: number
  costUsd: number
  days: {
    calories: number
    dateLabel: string
    day: number
    isFuture: boolean
    isToday: boolean
    key: string
    overflow: number
    progress: number
  }[]
  goal: number
  month: string
  startOffset: number
  total: number
}>()

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function dayLabel(day: typeof props.days[number]): string {
  if (!day.calories) return `${day.dateLabel}: no calories logged`
  const over = Math.max(0, day.calories - props.goal)
  return `${day.dateLabel}: ${day.calories.toLocaleString()} calories${over ? `, ${over.toLocaleString()} over goal` : ""}`
}
</script>

<template>
  <section class="month-overview" aria-label="Monthly calorie overview">
    <div class="month-summary">
      <dl class="month-metrics">
        <div><dt>Month energy</dt><dd><strong class="tabular-nums">{{ total.toLocaleString() }}</strong><small>kcal</small></dd></div>
        <div><dt>Daily average</dt><dd><strong class="tabular-nums">{{ average.toLocaleString() }}</strong><small>logged days</small></dd></div>
        <div><dt>AI spend</dt><dd><strong class="tabular-nums">{{ formatUsd(costUsd) }}</strong><small>Gateway account · all time</small></dd></div>
      </dl>
    </div>

    <div class="month-weekdays" aria-hidden="true">
      <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
    </div>
    <ol class="month-grid" :aria-label="`Daily calories for ${month}`">
      <li
        v-for="(day, index) in days"
        :key="day.key"
        class="month-day"
        :class="{ future: day.isFuture, over: day.overflow > 0, today: day.isToday }"
        :style="index === 0 ? { gridColumnStart: startOffset + 1 } : undefined"
        :aria-label="dayLabel(day)"
      >
        <span
          class="calorie-ring"
          :style="{ '--goal-progress': `${day.progress}%`, '--overflow-progress': `${day.overflow}%` }"
          aria-hidden="true"
        >
          <span>
            <strong v-if="day.calories" class="tabular-nums">{{ day.calories.toLocaleString() }}</strong>
            <strong v-else>—</strong>
          </span>
        </span>
        <span class="month-day-date tabular-nums">{{ day.day }}</span>
      </li>
    </ol>
  </section>
</template>
