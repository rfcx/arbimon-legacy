ALTER TABLE `arbimon2`.`templates`
ADD COLUMN `deleted` TINYINT(1) NULL DEFAULT 0 AFTER `date_created`;

ALTER TABLE `arbimon2`.`pattern_matchings`
ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `template_id`;

ALTER TABLE `arbimon2`.`pattern_matching_rois`
ADD COLUMN `score` DOUBLE NULL DEFAULT NULL AFTER `uri`;
