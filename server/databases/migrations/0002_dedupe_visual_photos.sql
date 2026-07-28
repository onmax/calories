ALTER TABLE `meals` ADD `photo_perceptual_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `meals_photo_perceptual_hash_idx` ON `meals` (`telegram_chat_id`,`photo_perceptual_hash`);