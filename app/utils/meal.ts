import type { CollectionItem } from "vite-hub/source";
import type { meals } from "../../server/collections/meals";

export type Meal = CollectionItem<typeof meals>;

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
  return meal.photoUrl;
}

export function parseUsageCostUsd(value?: string): number | undefined {
  const match = value?.replaceAll(",", "").match(/\$(\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const cost = Number(match[1]);
  return Number.isFinite(cost) ? cost : undefined;
}

export function formatUsageCostUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value > 0 && value < 0.01 ? 6 : 2,
    minimumFractionDigits: value > 0 && value < 0.01 ? 4 : 2,
    style: "currency",
  }).format(value);
}
