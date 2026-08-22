import { and, desc, eq, lt, lte, or } from "drizzle-orm";
import { useDatabase } from "vite-hub/database/drizzle";
import { defineCollection } from "vite-hub/source";

import type { CollectionLoadOptions } from "vite-hub/source";

type MealsCursor = readonly [createdAt: number, id: string];
interface MealsQuery {
  meal?: string;
}

export const meals = defineCollection(async ({ cursor, limit, query }: CollectionLoadOptions<
  MealsQuery,
  MealsCursor
>) => {
  const { db, schema } = useDatabase("default");
  const focusedMeal = query.meal
    ? await db
        .select({ createdAt: schema.meals.createdAt })
        .from(schema.meals)
        .where(eq(schema.meals.id, query.meal))
        .limit(1)
        .then((rows) => rows[0])
    : undefined;
  const olderThanCursor = cursor
    ? or(
        lt(schema.meals.createdAt, new Date(cursor[0])),
        and(eq(schema.meals.createdAt, new Date(cursor[0])), lt(schema.meals.id, cursor[1])),
      )
    : undefined;

  return db
    .select({
      caption: schema.meals.caption,
      confidence: schema.meals.confidence,
      createdAt: schema.meals.createdAt,
      id: schema.meals.id,
      items: schema.meals.items,
      photoPath: schema.meals.photoPath,
      totalCalories: schema.meals.totalCalories,
      totalProtein: schema.meals.totalProtein,
      usageCost: schema.meals.usageCost,
    })
    .from(schema.meals)
    .where(
      focusedMeal
        ? and(lte(schema.meals.createdAt, focusedMeal.createdAt), olderThanCursor)
        : olderThanCursor
          ? and(lte(schema.meals.createdAt, new Date()), olderThanCursor)
          : lte(schema.meals.createdAt, new Date()),
    )
    .orderBy(desc(schema.meals.createdAt), desc(schema.meals.id))
    .limit(limit);
}, {
  cursor: (meal) => [meal.createdAt.getTime(), meal.id] as const,
  defaultLimit: 24,
  maxLimit: 50,
  parseCursor(input) {
    if (!Array.isArray(input) || input.length !== 2
      || typeof input[0] !== "number" || !Number.isFinite(input[0])
      || typeof input[1] !== "string") {
      throw new TypeError("Meal cursor must contain a timestamp and id.");
    }
    return [input[0], input[1]] as const;
  },
  query(input): MealsQuery {
    return typeof input.meal === "string" && input.meal.length <= 128
      ? { meal: input.meal }
      : {};
  },
  transform({ photoPath, ...meal }) {
    return {
      ...meal,
      caption: meal.caption || undefined,
      confidence: meal.confidence || undefined,
      createdAt: meal.createdAt.toISOString(),
      items: meal.items.map((item) => ({
        calories: item.calories ?? item.kcal ?? 0,
        name: item.name ?? item.item ?? "Food",
        portion: item.portion
          ?? (item.portion_g === undefined ? "Estimated portion" : `${item.portion_g} g`),
        protein: item.protein,
      })),
      photoUrl: photoPath
        ? `/photos/${photoPath.split("/").map(encodeURIComponent).join("/")}`
        : undefined,
      totalCalories: meal.totalCalories ?? undefined,
      totalProtein: meal.totalProtein ?? undefined,
      usageCost: meal.usageCost ?? undefined,
    };
  },
});
