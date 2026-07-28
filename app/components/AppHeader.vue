<script setup lang="ts">
defineProps<{ pendingCount: number }>()
</script>

<template>
  <header class="app-header">
    <div class="brand-lockup">
      <span class="brand-symbol" aria-hidden="true"><UIcon name="i-lucide-flame" /></span>
      <div><p>Calories</p><span>Photo food journal</span></div>
    </div>

    <span class="source-status" :data-busy="pendingCount > 0"><span class="status-dot" /><span>{{ pendingCount ? `${pendingCount} processing` : "Telegram connected" }}</span></span>
  </header>
</template>
