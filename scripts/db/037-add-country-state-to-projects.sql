ALTER TABLE `arbimon2`.`projects`
ADD COLUMN `country` VARCHAR(255) DEFAULT NULL AFTER `reports_enabled`,
ADD COLUMN `state` VARCHAR(255) DEFAULT NULL AFTER `country`;
