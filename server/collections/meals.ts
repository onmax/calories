import { and, desc, eq, lt, lte, or } from "drizzle-orm";
import * as v from "valibot";
import { useDatabase } from "vite-hub/database/drizzle";
import { defineCollection } from "vite-hub/source";

export const meals = defineCollection(async ({ cursor, limit, query }) => {
  const { db, schema: { meals: table } } = useDatabase("default");
  const focusedMeal = query.meal
    ? await db
        .select({ createdAt: table.createdAt })
        .from(table)
        .where(eq(table.id, query.meal))
        .limit(1)
        .then((rows) => rows[0])
    : undefined;
  const olderThanCursor = cursor
    ? or(
        lt(table.createdAt, new Date(cursor[0])),
        and(eq(table.createdAt, new Date(cursor[0])), lt(table.id, cursor[1])),
      )
    : undefined;

  return db
    .select()
    .from(table)
    .where(and(
      lte(table.createdAt, focusedMeal?.createdAt ?? new Date()),
      olderThanCursor,
    ))
    .orderBy(desc(table.createdAt), desc(table.id))
    .limit(limit);
}, {
  cursor: meal => [meal.createdAt.getTime(), meal.id] as const,
  cursorSchema: v.tuple([v.number(), v.string()]),
  defaultLimit: 24,
  maxLimit: 50,
  querySchema: v.object({ meal: v.optional(v.pipe(v.string(), v.maxLength(128))) }),
  transform({ photoPath, ...meal }) {
    return {
      ...meal,
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
    };
  },
});
