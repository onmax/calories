import { desc } from "drizzle-orm";
import { defineCachedHandler } from "nitro/cache";
import database, * as schema from "../databases/config";

export default defineCachedHandler(
  async () => {
    const meals = await database
      .select({
        caption: schema.meals.caption,
        confidence: schema.meals.confidence,
        createdAt: schema.meals.createdAt,
        id: schema.meals.id,
        items: schema.meals.items,
        photoPath: schema.meals.photoPath,
        totalCalories: schema.meals.totalCalories,
      })
      .from(schema.meals)
      .orderBy(desc(schema.meals.createdAt))
      .limit(100);

    return {
      meals: meals.map(({ photoPath, ...meal }) => ({
        ...meal,
        caption: meal.caption || undefined,
        confidence: meal.confidence || undefined,
        createdAt: meal.createdAt.toISOString(),
        photoUrl: photoPath
          ? `/photos/${photoPath.split("/").map(encodeURIComponent).join("/")}`
          : undefined,
        totalCalories: meal.totalCalories ?? undefined,
      })),
    };
  },
  {
    maxAge: 1,
    swr: false,
  },
);
