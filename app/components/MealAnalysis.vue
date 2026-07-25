<script setup lang="ts">
import type { Meal } from "~/utils/meal"
import { formatUsd } from "~/utils/usage"

defineProps<{ meal?: Meal }>()
</script>

<template>
  <aside class="analysis-panel">
    <div class="analysis-scroll">
      <template v-if="meal">
        <header class="analysis-heading">
          <div><p class="panel-kicker"><UIcon name="i-lucide-scan-eye" /> AI estimate</p><h2>Inside this plate</h2></div>
          <span v-if="meal.confidence" class="confidence-badge" :data-confidence="meal.confidence">{{ meal.confidence }} confidence</span>
        </header>

        <p v-if="meal.caption" class="meal-caption">“{{ meal.caption }}”</p>

        <template v-if="meal.status === 'ready'">
          <section class="estimate-total">
            <p>Estimated energy</p>
            <div><strong class="tabular-nums">{{ meal.totalCalories?.toLocaleString() }}</strong><span>kilocalories</span></div>
          </section>

          <section class="analysis-cost">
            <div class="panel-section-heading"><h3>Analysis cost</h3></div>
            <dl class="cost-breakdown"><div class="cost-total"><dt>Gateway total</dt><dd><strong class="tabular-nums">{{ formatUsd(meal.costUsd) }}</strong></dd></div></dl>
          </section>

          <section class="breakdown-section">
            <div class="panel-section-heading"><h3>Food breakdown</h3><span>{{ meal.items.length }} detected</span></div>
            <div class="food-list">
              <article v-for="item in meal.items" :key="`${item.name}-${item.portion}`" class="food-row">
                <div class="food-row-heading"><div><h4>{{ item.name }}</h4><p>{{ item.portion }}</p></div><strong class="tabular-nums">{{ item.calories }} <span>kcal</span></strong></div>
                <span class="food-bar"><span :style="{ '--food-share': `${Math.max(4, Math.round(item.calories / Math.max(meal.totalCalories ?? 1, 1) * 100))}%` }" /></span>
              </article>
            </div>
          </section>

          <section v-if="meal.assumptions.length" class="assumption-box">
            <div class="panel-section-heading"><h3>What the model assumed</h3><UIcon name="i-lucide-info" /></div>
            <ul role="list"><li v-for="assumption in meal.assumptions" :key="assumption">{{ assumption }}</li></ul>
          </section>
        </template>

        <section v-else-if="meal.status === 'failed'" class="analysis-state failed-state">
          <UIcon name="i-lucide-circle-alert" />
          <div><h3>Analysis failed</h3><p>{{ meal.error || "Send this photo again in Telegram." }}</p></div>
        </section>

        <section v-else class="analysis-state">
          <UIcon name="i-lucide-loader-circle" class="spinning" />
          <div><h3>Reading the plate</h3><p>This view refreshes automatically while the estimate is in progress.</p></div>
        </section>

        <footer class="estimate-note">
          <UIcon name="i-lucide-aperture" />
          <p>A photo can’t reveal exact weight, oil, sugar, or hidden ingredients. Treat each number as an editable estimate, not a measurement.</p>
        </footer>
      </template>

      <div v-else class="analysis-empty">
        <span><UIcon name="i-lucide-image" /></span>
        <h2>No meal selected</h2>
        <p>Select a photo to see the model’s calorie estimate, food breakdown, and assumptions.</p>
      </div>
    </div>
  </aside>
</template>
