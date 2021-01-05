ALTER TABLE `arbimon2`.`sites` 
ADD COLUMN `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER `external_id`;

UPDATE sites SET created_at = null;