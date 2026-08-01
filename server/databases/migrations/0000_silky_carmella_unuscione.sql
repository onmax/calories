CREATE TABLE `meals` (
	`id` text PRIMARY KEY NOT NULL,
	`telegram_chat_id` text NOT NULL,
	`telegram_message_id` integer NOT NULL,
	`telegram_photo_unique_id` text,
	`caption` text,
	`photo_path` text,
	`items` text DEFAULT '[]' NOT NULL,
	`total_calories` integer,
	`confidence` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meals_created_idx` ON `meals` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `meals_telegram_photo_unique_idx` ON `meals` (`telegram_chat_id`,`telegram_photo_unique_id`);