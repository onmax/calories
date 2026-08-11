import { and, desc, eq, lt, lte, or } from "drizzle-orm";
import { defineEventHandler, getQuery } from "h3";
import database, * as schema from "../databases/config";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const limit = Math.min(Math.max(Number(query.limit) || 24, 1), 50);
  const [cursorTime, cursorId] =
    typeof query.cursor === "string" ? query.cursor.split("|") : [];
  const cursorDate = cursorTime ? new Date(Number(cursorTime)) : undefined;
  const olderThanCursor =
    cursorDate && !Number.isNaN(cursorDate.getTime()) && cursorId
      ? or(
          lt(schema.meals.createdAt, cursorDate),
          and(eq(schema.meals.createdAt, cursorDate), lt(schema.meals.id, cursorId)),
        )
      : undefined;
  const meals = await database
    .select({
      caption: schema.meals.caption,
      confidence: schema.meals.confidence,
      createdAt: schema.meals.createdAt,
      id: schema.meals.id,
      items: schema.meals.items,
      photoPath: schema.meals.photoPath,
      totalCalories: schema.meals.totalCalories,
      totalProtein: schema.meals.totalProtein,
    })
    .from(schema.meals)
    .where(
      olderThanCursor
        ? and(lte(schema.meals.createdAt, new Date()), olderThanCursor)
        : lte(schema.meals.createdAt, new Date()),
    )
    .orderBy(desc(schema.meals.createdAt), desc(schema.meals.id))
    .limit(limit + 1);

  const page = meals.slice(0, limit);
  const lastMeal = page.at(-1);

  return {
    meals: page.map(({ photoPath, ...meal }) => ({
      ...meal,
      caption: meal.caption || undefined,
      confidence: meal.confidence || undefined,
      createdAt: meal.createdAt.toISOString(),
      items: meal.items.map((item) => ({
        calories: item.calories ?? item.kcal ?? 0,
        name: item.name ?? item.item ?? "Food",
        portion:
          item.portion ??
          (item.portion_g === undefined ? "Estimated portion" : `${item.portion_g} g`),
        protein: item.protein,
      })),
      photoUrl: photoPath
        ? `/photos/${photoPath.split("/").map(encodeURIComponent).join("/")}`
        : undefined,
      totalCalories: meal.totalCalories ?? undefined,
      totalProtein: meal.totalProtein ?? undefined,
    })),
    nextCursor:
      meals.length > limit && lastMeal
        ? `${lastMeal.createdAt.getTime()}|${lastMeal.id}`
        : undefined,
  };
});
