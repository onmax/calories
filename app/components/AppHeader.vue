<script setup lang="ts">
defineProps<{
  calorieGoal: number;
  proteinGoal: number;
  settingsOpen: boolean;
}>();

defineEmits<{ settings: [] }>();
</script>

<template>
  <header class="app-header">
    <div class="brand-lockup">
      <span class="brand-symbol" aria-hidden="true"><UIcon name="i-lucide-flame" /></span>
      <div>
        <p>Calories</p>
        <span>Daily nutrition log</span>
      </div>
    </div>

    <div class="header-actions">
      <button
        class="goal-summary"
        type="button"
        :aria-expanded="settingsOpen"
        aria-controls="goal-editor"
        @click="$emit('settings')"
      >
        <span>Goal</span>
        <strong><i class="calorie-dot" />{{ calorieGoal.toLocaleString() }} kcal</strong>
        <strong><i class="protein-dot" />{{ proteinGoal }} g protein</strong>
      </button>

      <ClientOnly>
        <UColorModeButton class="theme-toggle" color="neutral" variant="ghost" />
        <template #fallback><span class="theme-toggle" aria-hidden="true" /></template>
      </ClientOnly>
    </div>
  </header>
</template>
