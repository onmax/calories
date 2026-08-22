import { and, desc, eq, lt, or } from "drizzle-orm";
import * as v from "valibot";
import { useDatabase } from "vite-hub/database/drizzle";
import { defineCollection } from "vite-hub/source";

export const meals = defineCollection(async ({ cursor, limit }) => {
  const { db, schema: { meals: table } } = useDatabase("default");
  const olderThanCursor = cursor
    ? or(
        lt(table.createdAt, new Date(cursor[0])),
        and(eq(table.createdAt, new Date(cursor[0])), lt(table.id, cursor[1])),
      )
    : undefined;

  return db
    .select()
    .from(table)
    .where(olderThanCursor)
    .orderBy(desc(table.createdAt), desc(table.id))
    .limit(limit);
}, {
  cursor: meal => [meal.createdAt.getTime(), meal.id] as const,
  cursorSchema: v.tuple([v.number(), v.string()]),
  defaultLimit: 24,
  maxLimit: 50,
  querySchema: v.object({}),
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
