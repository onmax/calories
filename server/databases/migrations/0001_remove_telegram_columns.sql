DROP INDEX `meals_telegram_photo_unique_idx`;
--> statement-breakpoint
ALTER TABLE `meals` DROP COLUMN `telegram_chat_id`;
--> statement-breakpoint
ALTER TABLE `meals` DROP COLUMN `telegram_message_id`;
--> statement-breakpoint
ALTER TABLE `meals` DROP COLUMN `telegram_photo_unique_id`;
