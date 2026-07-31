<script setup lang="ts">
defineProps<{
  average: number
  monthLabel: string
  total: number
}>()
</script>

<template>
  <header class="app-header">
    <div class="brand-lockup">
      <span class="brand-symbol" aria-hidden="true"><UIcon name="i-lucide-flame" /></span>
      <p>Calories</p>
    </div>

    <h1 class="header-month">{{ monthLabel }}</h1>

    <dl class="header-metrics">
      <div>
        <dt>Month</dt>
        <dd><strong class="tabular-nums">{{ total.toLocaleString() }}</strong><span>kcal</span></dd>
      </div>
      <div>
        <dt>Average</dt>
        <dd><strong class="tabular-nums">{{ average.toLocaleString() }}</strong><span>kcal</span></dd>
      </div>
    </dl>
  </header>
</template>
