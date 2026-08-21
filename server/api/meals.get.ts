import { and, desc, eq, gte, lt, lte, or } from "drizzle-orm";
import { defineEventHandler, getQuery } from "h3";
import { useDatabase } from "vite-hub/database/drizzle";
import { copenhagenDayRange } from "../utils/copenhagen-day";

export default defineEventHandler(async (event) => {
  const { db, schema } = useDatabase("default");
  const query = getQuery(event);
  const focus = typeof query.focus === "string" && query.focus.length <= 128
    ? query.focus
    : undefined;
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
  const focusedMeal = focus
    ? await db
        .select({ createdAt: schema.meals.createdAt })
        .from(schema.meals)
        .where(eq(schema.meals.id, focus))
        .limit(1)
        .then((rows) => rows[0])
    : undefined;
  const focusedDay = focusedMeal ? copenhagenDayRange(focusedMeal.createdAt) : undefined;
  const baseQuery = db
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
      focusedDay
        ? and(gte(schema.meals.createdAt, focusedDay[0]), lt(schema.meals.createdAt, focusedDay[1]))
        : olderThanCursor
        ? and(lte(schema.meals.createdAt, new Date()), olderThanCursor)
        : lte(schema.meals.createdAt, new Date()),
    )
    .orderBy(desc(schema.meals.createdAt), desc(schema.meals.id));
  const meals = focusedDay ? await baseQuery : await baseQuery.limit(limit + 1);

  const page = focusedDay ? meals : meals.slice(0, limit);
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
      usageCost: meal.usageCost ?? undefined,
    })),
    nextCursor:
      !focusedDay && meals.length > limit && lastMeal
        ? `${lastMeal.createdAt.getTime()}|${lastMeal.id}`
        : undefined,
  };
});
