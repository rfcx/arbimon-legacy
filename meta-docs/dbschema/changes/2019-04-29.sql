ALTER TABLE `arbimon2`.`templates`
ADD COLUMN `deleted` TINYINT(1) NULL DEFAULT 0 AFTER `date_created`;
