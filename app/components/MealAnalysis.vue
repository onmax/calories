<script setup lang="ts">
import {
  formatMealTime,
  formatUsageCostUsd,
  getMealTitle,
  parseUsageCostUsd,
  type Meal,
} from "~/utils/meal";

const props = defineProps<{ meal: Meal }>();
const usageCost = computed(() => parseUsageCostUsd(props.meal.usageCost));
</script>

<template>
  <article class="meal-entry">
    <span class="meal-photo"><MealPhoto :meal="meal" /></span>

    <header class="meal-heading">
      <div class="meal-title-line">
        <strong>{{ getMealTitle(meal) }}</strong>
        <span v-if="meal.confidence" class="confidence-badge">{{ meal.confidence }}</span>
      </div>
      <span class="meal-time">{{ formatMealTime(meal.createdAt) }}</span>
    </header>

    <div class="meal-macros tabular-nums">
      <strong>{{ meal.totalCalories?.toLocaleString() ?? "—" }} <small>kcal</small></strong>
      <span>{{ meal.totalProtein ?? "—" }} <small>g protein</small></span>
      <small v-if="usageCost !== undefined" class="meal-cost">
        AI · {{ formatUsageCostUsd(usageCost) }}
      </small>
    </div>

    <div class="food-list">
      <div v-for="item in meal.items" :key="`${item.name}-${item.portion}`" class="food-row">
        <div>
          <strong>{{ item.name }}</strong>
          <span>{{ item.portion }}</span>
        </div>
        <div class="food-macros tabular-nums">
          <span>{{ item.calories }} kcal</span>
          <strong>{{ item.protein ?? "—" }} g</strong>
        </div>
      </div>
    </div>
  </article>
</template>
