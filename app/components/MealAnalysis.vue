<script setup lang="ts">
import { formatMealTime, getMealPhotoUrl, getMealTitle, type Meal } from "~/utils/meal"

const props = defineProps<{
  dayCalories: number
  dayMealCount: number
  meal?: Meal
  meals: Meal[]
  proteinGoal: number
  selectedId?: string
}>()
const emit = defineEmits<{ select: [id: string] }>()
const visibleItems = computed(() => props.meal?.items.slice(0, 6) ?? [])
const hiddenItemCount = computed(() => Math.max(0, (props.meal?.items.length ?? 0) - visibleItems.value.length))
const photoMeals = computed(() => props.meals.filter(meal => getMealPhotoUrl(meal)))
</script>

<template>
  <aside class="analysis-panel">
    <div v-if="meal" :key="meal.id" class="analysis-scroll">
      <div v-if="photoMeals.length" class="meal-carousel" aria-label="Meal photos from this day">
        <button
          v-for="dayMeal in photoMeals"
          :key="dayMeal.id"
          type="button"
          :aria-label="getMealTitle(dayMeal)"
          :aria-pressed="dayMeal.id === selectedId"
          @click="emit('select', dayMeal.id)"
        >
          <img :src="getMealPhotoUrl(dayMeal)" alt="">
        </button>
      </div>

      <section class="meal-summary">
        <header class="analysis-heading">
          <div class="analysis-meta">
            <span class="meal-time">{{ formatMealTime(meal.createdAt) }}</span>
            <span v-if="meal.confidence" class="confidence-indicator" :data-confidence="meal.confidence">
              <span class="confidence-dot" />
              {{ meal.confidence }}
            </span>
          </div>
          <h2>{{ getMealTitle(meal) }}</h2>
        </header>

        <section v-if="meal.status === 'ready'" class="estimate-total">
          <strong class="tabular-nums">{{ meal.totalCalories?.toLocaleString() }}</strong>
          <span>kcal</span>
        </section>
      </section>

      <template v-if="meal.status === 'ready'">
        <section class="breakdown-section">
          <div class="panel-section-heading">
            <h3>What’s on the plate</h3>
            <span v-if="hiddenItemCount">+{{ hiddenItemCount }} more</span>
          </div>
          <div class="food-list">
            <article v-for="item in visibleItems" :key="`${item.name}-${item.portion}`" class="food-row">
              <div>
                <h4>{{ item.name }}</h4>
                <p>{{ item.portion }}</p>
              </div>
              <strong class="tabular-nums">{{ item.calories }} <span>kcal</span></strong>
            </article>
          </div>
        </section>

        <footer class="day-context">
          <span>Day</span>
          <strong class="tabular-nums">{{ dayCalories.toLocaleString() }} kcal</strong>
          <span>{{ dayMealCount }} {{ dayMealCount === 1 ? "meal" : "meals" }} · {{ proteinGoal }} g protein goal</span>
        </footer>
      </template>

      <section v-else-if="meal.status === 'failed'" class="analysis-state failed-state">
        <UIcon name="i-lucide-circle-alert" />
        <div><h3>Analysis failed</h3><p>{{ meal.error || "Send the photo again in Telegram." }}</p></div>
      </section>

      <section v-else class="analysis-state">
        <UIcon name="i-lucide-loader-circle" class="spinning" />
        <div><h3>Reading the plate</h3></div>
      </section>
    </div>

    <div v-else class="analysis-empty">
      <UIcon name="i-lucide-image" />
      <h2>Select a photo</h2>
    </div>
  </aside>
</template>
