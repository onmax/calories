export interface Meal {
  caption?: string;
  confidence?: "low" | "medium" | "high" | "user-stated";
  createdAt: string;
  id: string;
  items: Array<{
    calories: number;
    name: string;
    portion: string;
    protein?: number;
  }>;
  photoUrl?: string;
  totalCalories?: number;
  totalProtein?: number;
}

export interface MealsPage {
  meals: Meal[];
  nextCursor?: string;
}

export function formatMealTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
    new Date(value),
  );
}

export function getMealTitle(meal: Meal): string {
  return (
    meal.items
      .map((item) => item.name)
      .slice(0, 2)
      .join(" + ") ||
    meal.caption ||
    "Meal"
  );
}

export function getMealPhotoUrl(meal: Meal): string | undefined {
  if (!meal.photoUrl) return undefined;
  return import.meta.dev
    ? new URL(meal.photoUrl, "https://vitehub-calories.maximogarciamtnez.workers.dev").toString()
    : meal.photoUrl;
}
