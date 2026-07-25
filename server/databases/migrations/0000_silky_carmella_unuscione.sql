CREATE TABLE `meals` (
	`id` text PRIMARY KEY NOT NULL,
	`telegram_chat_id` text NOT NULL,
	`telegram_message_id` integer NOT NULL,
	`telegram_photo_file_id` text,
	`caption` text,
	`photo_path` text NOT NULL,
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
CREATE INDEX `meals_created_idx` ON `meals` (`created_at`);--> statement-breakpoint
CREATE INDEX `meals_status_idx` ON `meals` (`status`);
