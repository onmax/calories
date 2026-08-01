import { defineDatabase } from "vite-hub/database";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const meals = sqliteTable(
  "meals",
  {
    id: text("id").primaryKey(),
    telegramChatId: text("telegram_chat_id").notNull(),
    telegramMessageId: integer("telegram_message_id").notNull(),
    telegramPhotoUniqueId: text("telegram_photo_unique_id"),
    caption: text("caption"),
    photoPath: text("photo_path"),
    items: text("items", { mode: "json" })
      .$type<Array<{ calories: number; name: string; portion: string }>>()
      .default([])
      .notNull(),
    totalCalories: integer("total_calories"),
    confidence: text("confidence", { enum: ["low", "medium", "high"] }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(now).notNull(),
  },
  (table) => [
    index("meals_created_idx").on(table.createdAt),
    uniqueIndex("meals_telegram_photo_unique_idx").on(
      table.telegramChatId,
      table.telegramPhotoUniqueId,
    ),
  ],
);

export default defineDatabase({
  cloudflare: { databaseName: "vitehub-calories" },
  schema: { meals },
});
