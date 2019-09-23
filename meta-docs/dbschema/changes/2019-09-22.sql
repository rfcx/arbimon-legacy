ALTER TABLE `arbimon2`.`sites`
DROP INDEX `name` ,
ADD INDEX `name` USING BTREE (`name`);
;


ALTER TABLE `arbimon2`.`pattern_matching_rois`
ADD COLUMN `denorm_site_id` INT(10) UNSIGNED NULL AFTER `expert_validated`,
ADD COLUMN `denorm_recording_datetime` DATETIME NULL AFTER `denorm_site_id`,
ADD COLUMN `denorm_recording_date` DATE NULL AFTER `denorm_recording_datetime`
;


ALTER TABLE `arbimon2`.`pattern_matching_rois`
ADD INDEX `pattern_matching_matches_site_score_idx` (`pattern_matching_id` ASC, `denorm_site_id` ASC, `score` ASC);
;

ALTER TABLE `arbimon2`.`pattern_matching_rois`
ADD INDEX `pattern_matching_matches_site_datetime_score_idx` (`pattern_matching_id` ASC, `denorm_site_id` ASC, `denorm_recording_date` ASC, `score` ASC);
;


ALTER TABLE `arbimon2`.`pattern_matching_rois`
ADD INDEX `fk_pattern_matching_rois_1_idx` (`denorm_site_id` ASC);
;


ALTER TABLE `arbimon2`.`pattern_matching_rois`
ADD CONSTRAINT `fk_pattern_matching_rois_1` FOREIGN KEY (`denorm_site_id`) REFERENCES `arbimon2`.`sites` (`site_id`)
ON DELETE NO ACTION
ON UPDATE NO ACTION
;
