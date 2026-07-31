import { defineHandler } from "h3"
import { useSource } from "@vite-hub/source"
import { sql } from "drizzle-orm"
import "../sources/meals"
import database, * as schema from "../databases/config"

export default defineHandler(async (event) => {
  event.res.headers.set("Cache-Control", "private, no-store")
  const [items, [storedCost]] = await Promise.all([
    useSource("meals").items(),
    database.select({
      value: sql<number>`coalesce(sum(${schema.meals.costUsd}), 0)`.mapWith(Number),
    }).from(schema.meals),
  ])
  return {
    costUsd: storedCost?.value ?? 0,
    meals: items.flatMap(({ data: meal }) => meal ? [{
      ...meal,
      analyzedAt: meal.analyzedAt?.toISOString(),
      caption: meal.caption || undefined,
      confidence: meal.confidence || undefined,
      createdAt: meal.createdAt.toISOString(),
      error: meal.error || undefined,
      model: meal.model || undefined,
      photoUrl: meal.photo
        ? `/photos/${meal.photo.key.split("/").map(encodeURIComponent).join("/")}`
        : undefined,
      totalCalories: meal.totalCalories ?? undefined,
    }] : []),
  }
})
