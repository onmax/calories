import { defineDatabase } from "vite-hub/database"
import { sql } from "drizzle-orm"
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`

export const meals = sqliteTable("meals", {
  id: text("id").primaryKey(),
  telegramChatId: text("telegram_chat_id").notNull(),
  telegramMessageId: integer("telegram_message_id").notNull(),
  telegramPhotoFileId: text("telegram_photo_file_id"),
  telegramPhotoUniqueId: text("telegram_photo_unique_id"),
  photoPerceptualHash: text("photo_perceptual_hash"),
  caption: text("caption"),
  photoPath: text("photo_path"),
  photoContentType: text("photo_content_type"),
  photoBytes: integer("photo_bytes"),
  status: text("status", { enum: ["received", "processing", "ready", "failed"] }).default("received").notNull(),
  items: text("items", { mode: "json" }).$type<Array<{ calories: number, name: string, portion: string }>>().default([]).notNull(),
  totalCalories: integer("total_calories"),
  assumptions: text("assumptions", { mode: "json" }).$type<string[]>().default([]).notNull(),
  confidence: text("confidence", { enum: ["low", "medium", "high"] }),
  model: text("model"),
  attempts: integer("attempts").default(0).notNull(),
  rawOutput: text("raw_output", { mode: "json" }).$type<Record<string, unknown>>(),
  costUsd: real("cost_usd").default(0).notNull(),
  error: text("error"),
  analyzedAt: integer("analyzed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(now).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(now).$onUpdate(() => new Date()).notNull(),
}, table => [
  index("meals_created_idx").on(table.createdAt),
  index("meals_status_idx").on(table.status),
  uniqueIndex("meals_photo_perceptual_hash_idx").on(table.telegramChatId, table.photoPerceptualHash),
  uniqueIndex("meals_telegram_photo_unique_idx").on(table.telegramChatId, table.telegramPhotoUniqueId),
])

export default defineDatabase({
  cloudflare: {
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID,
    databaseName: process.env.CLOUDFLARE_D1_DATABASE_NAME || "vitehub-calories",
  },
  schema: { meals },
})
