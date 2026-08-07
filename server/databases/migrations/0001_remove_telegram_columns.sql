DROP INDEX `meals_telegram_photo_unique_idx`;
ALTER TABLE `meals` DROP COLUMN `telegram_chat_id`;
ALTER TABLE `meals` DROP COLUMN `telegram_message_id`;
ALTER TABLE `meals` DROP COLUMN `telegram_photo_unique_id`;
