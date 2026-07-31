PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_meals` (
	`id` text PRIMARY KEY NOT NULL,
	`telegram_chat_id` text NOT NULL,
	`telegram_message_id` integer NOT NULL,
	`telegram_photo_file_id` text,
	`telegram_photo_unique_id` text,
	`photo_perceptual_hash` text,
	`caption` text,
	`photo_path` text,
	`photo_content_type` text,
	`photo_bytes` integer,
	`status` text DEFAULT 'received' NOT NULL,
	`items` text DEFAULT '[]' NOT NULL,
	`total_calories` integer,
	`assumptions` text DEFAULT '[]' NOT NULL,
	`confidence` text,
	`model` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`raw_output` text,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`error` text,
	`analyzed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_meals`("id", "telegram_chat_id", "telegram_message_id", "telegram_photo_file_id", "telegram_photo_unique_id", "photo_perceptual_hash", "caption", "photo_path", "photo_content_type", "photo_bytes", "status", "items", "total_calories", "assumptions", "confidence", "model", "attempts", "raw_output", "cost_usd", "error", "analyzed_at", "created_at", "updated_at") SELECT "id", "telegram_chat_id", "telegram_message_id", "telegram_photo_file_id", "telegram_photo_unique_id", "photo_perceptual_hash", "caption", "photo_path", "photo_content_type", "photo_bytes", "status", "items", "total_calories", "assumptions", "confidence", "model", "attempts", "raw_output", "cost_usd", "error", "analyzed_at", "created_at", "updated_at" FROM `meals`;--> statement-breakpoint
DROP TABLE `meals`;--> statement-breakpoint
ALTER TABLE `__new_meals` RENAME TO `meals`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `meals_created_idx` ON `meals` (`created_at`);--> statement-breakpoint
CREATE INDEX `meals_status_idx` ON `meals` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `meals_photo_perceptual_hash_idx` ON `meals` (`telegram_chat_id`,`photo_perceptual_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `meals_telegram_photo_unique_idx` ON `meals` (`telegram_chat_id`,`telegram_photo_unique_id`);