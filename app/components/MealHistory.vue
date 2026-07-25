<script setup lang="ts">
import { formatMealTime, getMealStatusLabel, getMealTitle, type Meal } from "~/utils/meal"
import { formatUsd } from "~/utils/usage"

defineProps<{ hasError: boolean, loading: boolean, meals: Meal[], selectedId?: string }>()
const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <section class="history-section" aria-labelledby="history-heading">
    <div class="history-heading">
      <div><p class="section-label">Photo roll</p><h2 id="history-heading">Recent meals</h2></div>
      <span>{{ meals.length }} captured</span>
    </div>

    <div v-if="hasError" class="error-state inline-state">
      <UIcon name="i-lucide-cloud-off" />
      <div><strong>Couldn’t load the journal</strong><p>Try refreshing in a moment.</p></div>
    </div>

    <div v-else-if="meals.length" class="meal-roll">
      <button v-for="meal in meals" :key="meal.id" type="button" class="meal-card" :class="{ selected: selectedId === meal.id }" :aria-pressed="selectedId === meal.id" @click="emit('select', meal.id)">
        <img :src="meal.photoUrl" :alt="getMealTitle(meal)" loading="lazy">
        <span class="meal-card-copy"><strong>{{ getMealTitle(meal) }}</strong><span>{{ formatMealTime(meal.createdAt) }} · {{ meal.totalCalories ? `${meal.totalCalories} kcal` : getMealStatusLabel(meal) }}<template v-if="meal.status === 'ready'"> · {{ formatUsd(meal.costUsd) }}</template></span></span>
        <UIcon name="i-lucide-chevron-right" />
        <span class="touch-target" aria-hidden="true" />
      </button>
    </div>

    <div v-else-if="!loading" class="inline-state">
      <UIcon name="i-lucide-send" />
      <div><strong>No meals yet</strong><p>Your Telegram uploads will collect here.</p></div>
    </div>
  </section>
</template>
