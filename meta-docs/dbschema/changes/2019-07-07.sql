ALTER TABLE `arbimon2`.`projects`
ADD COLUMN `citizen_scientist_enabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `processing_usage`;
