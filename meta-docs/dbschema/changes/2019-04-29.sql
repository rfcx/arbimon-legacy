ALTER TABLE `arbimon2`.`templates`
ADD COLUMN `deleted` TINYINT(1) NULL DEFAULT 0 AFTER `date_created`;

ALTER TABLE `arbimon2`.`pattern_matchings`
ADD COLUMN `deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `template_id`;

ALTER TABLE `arbimon2`.`pattern_matchings`
ADD COLUMN `completed` TINYINT(1) NOT NULL DEFAULT 0 AFTER `template_id`;

UPDATE pattern_matchings SET completed = 1;

ALTER TABLE `arbimon2`.`pattern_matching_rois`
ADD COLUMN `score` DOUBLE NULL DEFAULT NULL AFTER `uri`;

ALTER TABLE `arbimon2`.`pattern_matchings`
ADD COLUMN `job_id` BIGINT(20) UNSIGNED NULL AFTER `deleted`;

UPDATE pattern_matchings, jobs
SET pattern_matchings.job_id = jobs.job_id
WHERE pattern_matchings.project_id = jobs.project_id
  AND pattern_matchings.timestamp = jobs.last_update
  AND jobs.job_type_id = 6;

UPDATE jobs SET state = 'completed' WHERE job_type_id = 6;

ALTER TABLE `arbimon2`.`pattern_matchings`
ADD COLUMN `citizen_scientist` TINYINT(1) NOT NULL DEFAULT 0;
