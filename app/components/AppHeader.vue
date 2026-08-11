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

    <UButton
      :aria-expanded="settingsOpen"
      color="neutral"
      icon="i-lucide-sliders-horizontal"
      variant="ghost"
      @click="$emit('settings')"
    >
      <span class="goal-button-copy">{{ calorieGoal.toLocaleString() }} kcal · {{ proteinGoal }} g</span>
    </UButton>
  </header>
</template>
