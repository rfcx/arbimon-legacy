ALTER TABLE `arbimon2`.`projects`
ADD COLUMN `disabled` tinyint(1) NOT NULL DEFAULT '0';

ALTER TABLE `arbimon2`.`projects`
DROP COLUMN `disabled`
