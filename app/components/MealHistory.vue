<script setup lang="ts">
import { formatMealTime, getMealPhotoUrl, getMealStatusLabel, getMealTitle, type Meal } from "~/utils/meal"

defineProps<{
  calories: number
  dateLabel: string
  goal: number
  hasError: boolean
  loading: boolean
  meals: Meal[]
  selectedId?: string
}>()
const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <section class="day-meals" aria-labelledby="day-meals-heading">
    <div class="day-meals-heading">
      <div>
        <h2 id="day-meals-heading">{{ dateLabel }}</h2>
        <span>{{ meals.length }} {{ meals.length === 1 ? "photo" : "photos" }}</span>
      </div>
      <p class="day-energy">
        <strong class="tabular-nums">{{ calories.toLocaleString() }}</strong>
        <span>/ {{ goal.toLocaleString() }} kcal</span>
      </p>
    </div>

    <div v-if="hasError" class="error-state inline-state">
      <UIcon name="i-lucide-cloud-off" />
      <div><strong>Couldn’t load the journal</strong></div>
    </div>

    <div v-else-if="meals.length" class="meal-strip">
      <button
        v-for="meal in meals"
        :key="meal.id"
        type="button"
        class="meal-card"
        :class="{ selected: selectedId === meal.id }"
        :aria-label="`${getMealTitle(meal)}, ${meal.totalCalories ? `${meal.totalCalories} calories` : getMealStatusLabel(meal)}`"
        :aria-pressed="selectedId === meal.id"
        @click="emit('select', meal.id)"
      >
        <img v-if="getMealPhotoUrl(meal)" :src="getMealPhotoUrl(meal)" :alt="getMealTitle(meal)" loading="lazy">
        <span v-else class="meal-card-photo-placeholder"><UIcon name="i-lucide-message-square-text" /></span>
        <span class="meal-card-shade" />
        <span class="meal-card-time">{{ formatMealTime(meal.createdAt) }}</span>
        <span class="meal-card-copy">
          <strong>{{ meal.totalCalories?.toLocaleString() ?? "…" }} <small>kcal</small></strong>
          <span>{{ getMealTitle(meal) }}</span>
        </span>
      </button>
    </div>

    <div v-else-if="!loading" class="empty-day">
      <UIcon name="i-lucide-send" />
      <strong>No photos this day</strong>
    </div>
  </section>
</template>
