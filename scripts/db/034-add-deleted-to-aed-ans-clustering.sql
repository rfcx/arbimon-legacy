ALTER TABLE `arbimon2`.`job_params_audio_event_detection_clustering`
ADD COLUMN `deleted` tinyint(1) NOT NULL DEFAULT '0';

ALTER TABLE `arbimon2`.`job_params_audio_event_clustering`
ADD COLUMN `deleted` tinyint(1) NOT NULL DEFAULT '0';
