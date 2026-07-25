<script setup lang="ts">
defineProps<{ loading: boolean, pendingCount: number }>()
const emit = defineEmits<{ refresh: [] }>()
</script>

<template>
  <header class="app-header">
    <div class="brand-lockup">
      <span class="brand-symbol" aria-hidden="true"><UIcon name="i-lucide-flame" /></span>
      <div><p>Calories</p><span>Photo food journal</span></div>
    </div>

    <div class="header-actions">
      <span class="source-status" :data-busy="pendingCount > 0"><span class="status-dot" /><span>{{ pendingCount ? `${pendingCount} processing` : "Telegram connected" }}</span></span>
      <span class="read-only-badge"><UIcon name="i-lucide-eye" /> Read only</span>
      <button class="refresh-button" type="button" aria-label="Refresh meals" :disabled="loading" @click="emit('refresh')">
        <UIcon name="i-lucide-refresh-cw" :class="{ spinning: loading }" />
        <span class="touch-target" aria-hidden="true" />
      </button>
    </div>
  </header>
</template>
