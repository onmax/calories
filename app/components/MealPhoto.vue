<script setup lang="ts">
import { getMealPhotoUrl, type Meal } from "~/utils/meal";

const props = defineProps<{ meal: Meal }>();
const failed = ref(false);
const source = computed(() => (failed.value ? undefined : getMealPhotoUrl(props.meal)));

watch(() => props.meal.photoUrl, () => {
  failed.value = false;
});
</script>

<template>
  <img v-if="source" :src="source" alt="" loading="lazy" @error="failed = true" />
  <UIcon v-else name="i-lucide-utensils" aria-hidden="true" />
</template>
