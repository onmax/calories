import { createGateway } from "@ai-sdk/gateway"
import { defineHandler } from "h3"
import { useSource } from "@vite-hub/source"
import { sql } from "drizzle-orm"
import { useServerEnv } from "#vitehub/env/server"
import "../sources/meals"
import database, * as schema from "../databases/config"

let spendCache: { expiresAt: number, value: number } | undefined

async function getGatewaySpend(): Promise<number> {
  if (spendCache && spendCache.expiresAt > Date.now()) return spendCache.value
  const credits = await createGateway({
    apiKey: useServerEnv().vercelAiGatewayToken.unseal(),
  }).getCredits()
  const value = Number(credits.totalUsed)
  if (!Number.isFinite(value)) throw new TypeError("AI Gateway returned an invalid consumed credit total.")
  spendCache = { expiresAt: Date.now() + 5 * 60_000, value }
  return value
}

export default defineHandler(async (event) => {
  event.res.headers.set("Cache-Control", "private, no-store")
  const [items, [storedCost], gatewaySpend] = await Promise.all([
    useSource("meals").items(),
    database.select({
      value: sql<number>`coalesce(sum(${schema.meals.costUsd}), 0)`.mapWith(Number),
    }).from(schema.meals),
    getGatewaySpend().catch(() => undefined),
  ])
  return {
    costUsd: gatewaySpend ?? storedCost?.value ?? 0,
    meals: items.flatMap(({ data: meal }) => meal ? [{
      ...meal,
      analyzedAt: meal.analyzedAt?.toISOString(),
      caption: meal.caption || undefined,
      confidence: meal.confidence || undefined,
      createdAt: meal.createdAt.toISOString(),
      error: meal.error || undefined,
      model: meal.model || undefined,
      photoUrl: `/photos/${meal.photo.key.split("/").map(encodeURIComponent).join("/")}`,
      totalCalories: meal.totalCalories ?? undefined,
    }] : []),
  }
})
