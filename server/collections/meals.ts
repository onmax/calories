import { useDatabase } from "vite-hub/database/drizzle";
import { defineCollection, table } from "vite-hub/source";

const { db, schema } = useDatabase("default");

export const meals = defineCollection({
  source: table({
    db,
    defaultLimit: 24,
    maxLimit: 50,
    orderBy: {
      column: schema.meals.createdAt,
      direction: "desc",
      tieBreaker: schema.meals.id,
    },
    table: schema.meals,
  }),
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
