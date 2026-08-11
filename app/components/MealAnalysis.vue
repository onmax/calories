<script setup lang="ts">
import { formatMealTime, getMealPhotoUrl, getMealTitle, type Meal } from "~/utils/meal";

defineProps<{
  expanded: boolean;
  meal: Meal;
}>();

defineEmits<{ toggle: [] }>();

const tabs = [
  { label: "Foods", slot: "foods", value: "foods" },
  { label: "Notes", slot: "notes", value: "notes" },
];
</script>

<template>
  <article class="meal-entry" :class="{ 'is-expanded': expanded }">
    <button
      class="meal-trigger"
      type="button"
      :aria-expanded="expanded"
      :aria-label="`${expanded ? 'Collapse' : 'Expand'} ${getMealTitle(meal)}`"
      @click="$emit('toggle')"
    >
      <span class="meal-photo">
        <img v-if="getMealPhotoUrl(meal)" :src="getMealPhotoUrl(meal)" alt="" loading="lazy" />
        <UIcon v-else name="i-lucide-utensils" aria-hidden="true" />
      </span>

      <span class="meal-copy">
        <span class="meal-time">{{ formatMealTime(meal.createdAt) }}</span>
        <strong>{{ getMealTitle(meal) }}</strong>
        <span>{{ meal.items.map((item) => item.portion).slice(0, 2).join(" · ") }}</span>
      </span>

      <span class="meal-macros tabular-nums">
        <strong>{{ meal.totalCalories?.toLocaleString() ?? "—" }} <small>kcal</small></strong>
        <span>{{ meal.totalProtein ?? "—" }} <small>g protein</small></span>
      </span>

      <UIcon class="meal-chevron" name="i-lucide-chevron-down" aria-hidden="true" />
    </button>

    <div v-if="expanded" class="meal-detail">
      <UTabs
        :items="tabs"
        color="neutral"
        default-value="foods"
        :ui="{ content: 'meal-tab-content', list: 'meal-tab-list' }"
        variant="link"
      >
        <template #foods>
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
        </template>

        <template #notes>
          <dl class="meal-notes">
            <div>
              <dt>Caption</dt>
              <dd>{{ meal.caption || "No caption" }}</dd>
            </div>
            <div>
              <dt>Estimate</dt>
              <dd>{{ meal.confidence || "Unknown" }} confidence</dd>
            </div>
          </dl>
        </template>
      </UTabs>
    </div>
  </article>
</template>
