<script setup lang="ts">
import { formatMealTime, getMealPhotoUrl, getMealTitle, type Meal } from "~/utils/meal";

const props = defineProps<{
  dayCalories: number;
  dayMealCount: number;
  meal?: Meal;
  meals: Meal[];
  proteinGoal: number;
  selectedId?: string;
}>();
const emit = defineEmits<{ select: [id: string] }>();
const visibleItems = computed(() => props.meal?.items.slice(0, 6) ?? []);
const hiddenItemCount = computed(() =>
  Math.max(0, (props.meal?.items.length ?? 0) - visibleItems.value.length),
);
</script>

<template>
  <aside class="analysis-panel">
    <div v-if="meal" :key="meal.id" class="analysis-scroll">
      <div v-if="meals.length" class="meal-carousel" aria-label="Meals from this day">
        <button
          v-for="dayMeal in meals"
          :key="dayMeal.id"
          type="button"
          :aria-label="getMealTitle(dayMeal)"
          :aria-pressed="dayMeal.id === selectedId"
          @click="emit('select', dayMeal.id)"
        >
          <img v-if="getMealPhotoUrl(dayMeal)" :src="getMealPhotoUrl(dayMeal)" alt="" />
          <span v-else class="meal-carousel-fallback">
            <small>{{ formatMealTime(dayMeal.createdAt) }}</small>
            <strong>{{ getMealTitle(dayMeal) }}</strong>
          </span>
        </button>
      </div>

      <section class="meal-summary">
        <header class="analysis-heading">
          <div class="analysis-meta">
            <span class="meal-time">{{ formatMealTime(meal.createdAt) }}</span>
            <span
              v-if="meal.confidence"
              class="confidence-indicator"
              :data-confidence="meal.confidence"
            >
              <span class="confidence-dot" />
              {{ meal.confidence }}
            </span>
          </div>
          <h2>{{ getMealTitle(meal) }}</h2>
        </header>

        <section class="estimate-total">
          <strong class="tabular-nums">{{ meal.totalCalories?.toLocaleString() }}</strong>
          <span>kcal</span>
        </section>
      </section>

      <section class="breakdown-section">
        <div class="panel-section-heading">
          <h3>What’s on the plate</h3>
          <span v-if="hiddenItemCount">+{{ hiddenItemCount }} more</span>
        </div>
        <div class="food-list">
          <article
            v-for="item in visibleItems"
            :key="`${item.name}-${item.portion}`"
            class="food-row"
          >
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
        <span
          >{{ dayMealCount }} {{ dayMealCount === 1 ? "meal" : "meals" }} · {{ proteinGoal }} g
          protein goal</span
        >
      </footer>
    </div>

    <div v-else class="analysis-empty">
      <UIcon name="i-lucide-image" />
      <h2>Select a meal</h2>
    </div>
  </aside>
</template>
