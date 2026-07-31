export interface Meal {
  analyzedAt?: string
  assumptions: string[]
  caption?: string
  confidence?: "low" | "medium" | "high"
  costUsd: number
  createdAt: string
  error?: string
  id: string
  items: Array<{
    calories: number
    name: string
    portion: string
  }>
  model?: string
  photoUrl?: string
  status: "received" | "processing" | "ready" | "failed"
  totalCalories?: number
}

export function formatMealTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value))
}

export function getMealTitle(meal: Meal): string {
  return meal.items.map(item => item.name).slice(0, 2).join(" + ") || meal.caption || (meal.status === "failed" ? "Analysis failed" : "Analyzing photo")
}

export function getMealPhotoUrl(meal: Meal): string | undefined {
  if (!meal.photoUrl) return undefined
  return import.meta.dev
    ? new URL(meal.photoUrl, "https://vitehub-calories.maximogarciamtnez.workers.dev").toString()
    : meal.photoUrl
}

export function getMealStatusLabel(meal: Meal): string {
  if (meal.status === "ready") return "Analysis ready"
  if (meal.status === "failed") return "Needs another try"
  return "Analyzing photo"
}
