import { custom, registerSource, type Source } from "@vite-hub/source"
import { desc, eq } from "drizzle-orm"
import database, * as schema from "../databases/config"

const mealSelection = {
  analyzedAt: schema.meals.analyzedAt,
  assumptions: schema.meals.assumptions,
  caption: schema.meals.caption,
  confidence: schema.meals.confidence,
  costUsd: schema.meals.costUsd,
  createdAt: schema.meals.createdAt,
  error: schema.meals.error,
  id: schema.meals.id,
  items: schema.meals.items,
  model: schema.meals.model,
  photoContentType: schema.meals.photoContentType,
  photoPath: schema.meals.photoPath,
  status: schema.meals.status,
  totalCalories: schema.meals.totalCalories,
}

type MealRow = Pick<typeof schema.meals.$inferSelect, keyof typeof mealSelection>

export interface MealRecord extends Omit<MealRow, "photoContentType" | "photoPath"> {
  photo?: {
    key: string
    mediaType?: string
  }
}

export interface MealSourceMetadata {
  assetStore: "blob"
  recordStore: "database"
}

function toSourceItem(meal: MealRow) {
  const { photoContentType, photoPath, ...data } = meal
  return {
    data: {
      ...data,
      ...(photoPath
        ? {
            photo: {
              key: photoPath,
              ...(photoContentType ? { mediaType: photoContentType } : {}),
            },
          }
        : {}),
    },
    key: meal.id,
    metadata: {
      assetStore: "blob",
      recordStore: "database",
    } satisfies MealSourceMetadata,
  }
}

export const mealsSource = custom({
  name: "meals",
  async getKeys() {
    return (await database
      .select({ id: schema.meals.id })
      .from(schema.meals)
      .orderBy(desc(schema.meals.createdAt))
      .limit(100))
      .map(meal => meal.id)
  },
  async getItem(id) {
    const [meal] = await database
      .select(mealSelection)
      .from(schema.meals)
      .where(eq(schema.meals.id, id))
      .limit(1)
    if (!meal) throw new Error(`Meal source could not find ${JSON.stringify(id)}.`)
    return toSourceItem(meal)
  },
  async getItems() {
    return (await database
      .select(mealSelection)
      .from(schema.meals)
      .orderBy(desc(schema.meals.createdAt))
      .limit(100))
      .map(toSourceItem)
  },
} satisfies Source<string, MealRecord, MealSourceMetadata>)

registerSource("meals", mealsSource)

declare global {
  interface ViteHubSourceMap {
    meals: typeof mealsSource
  }
}
