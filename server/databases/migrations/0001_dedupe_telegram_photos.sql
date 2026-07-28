ALTER TABLE `meals` ADD `telegram_photo_unique_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `meals_telegram_photo_unique_idx` ON `meals` (`telegram_chat_id`,`telegram_photo_unique_id`);