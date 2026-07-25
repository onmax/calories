<script setup lang="ts">
import { formatUsd } from "~/utils/usage"

defineProps<{
  costUsd: number
  days: { calories: number, height: number, isToday: boolean, key: string, label: string }[]
  total: number
}>()
</script>

<template>
  <section class="week-strip" aria-labelledby="week-heading">
    <div class="week-summary">
      <div><p class="section-label">Last seven days</p><h2 id="week-heading">A quiet view of the week</h2></div>
      <dl class="week-metrics">
        <div><dt>Seven-day energy</dt><dd><strong class="tabular-nums">{{ total.toLocaleString() }}</strong> kcal</dd></div>
        <div><dt>AI spend</dt><dd><strong class="tabular-nums">{{ formatUsd(costUsd) }}</strong></dd></div>
      </dl>
    </div>

    <div class="week-chart" aria-label="Calories logged over the last seven days">
      <div v-for="day in days" :key="day.key" class="week-day" :class="{ today: day.isToday }">
        <span class="week-value tabular-nums">{{ day.calories ? day.calories.toLocaleString() : "·" }}</span>
        <span class="week-rail"><span class="week-fill" :style="{ '--bar-height': `${day.height}%` }" /></span>
        <span class="week-label">{{ day.label }}</span>
      </div>
    </div>
  </section>
</template>
