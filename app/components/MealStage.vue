<script setup lang="ts">
import { formatMealTime, getMealStatusLabel, getMealTitle, type Meal } from "~/utils/meal"

defineProps<{ loading: boolean, meal?: Meal }>()
</script>

<template>
  <article class="meal-stage" :class="{ empty: !meal }">
    <template v-if="meal">
      <img v-if="meal.photoUrl" :key="meal.id" :src="meal.photoUrl" :alt="getMealTitle(meal)" class="stage-photo">
      <div v-else class="stage-photo stage-photo-placeholder">
        <UIcon name="i-lucide-message-square-text" />
      </div>
      <div class="stage-shade" />
      <div class="stage-topline">
        <span class="stage-status" :data-status="meal.status"><span />{{ getMealStatusLabel(meal) }}</span>
        <span>{{ new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(meal.createdAt)) }} · {{ formatMealTime(meal.createdAt) }}</span>
      </div>
      <div class="stage-caption">
        <div><p>Selected meal</p><h2>{{ getMealTitle(meal) }}</h2></div>
        <p v-if="meal.totalCalories" class="stage-calories"><strong class="tabular-nums">{{ meal.totalCalories.toLocaleString() }}</strong><span>kcal</span></p>
      </div>
    </template>

    <div v-else class="stage-empty">
      <span><UIcon :name="loading ? 'i-lucide-loader-circle' : 'i-lucide-camera'" :class="{ spinning: loading }" /></span>
      <h2>{{ loading ? "Loading your journal" : "Your next meal starts here" }}</h2>
      <p>Send a food photo to the Telegram bot. Its estimate will appear here automatically.</p>
    </div>
  </article>
</template>
