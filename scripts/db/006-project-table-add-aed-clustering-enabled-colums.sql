ALTER TABLE `arbimon2`.`projects`
ADD COLUMN `aed_enabled` tinyint(1) NOT NULL DEFAULT '0';

ALTER TABLE `arbimon2`.`projects`
ADD COLUMN `clustering_enabled` tinyint(1) NOT NULL DEFAULT '0';
