ALTER TABLE `arbimon2`.`job_params_audio_event_clustering`
ADD COLUMN `aeds_detected` INT NOT NULL DEFAULT 0,
ADD COLUMN `clusters_detected` INT NOT NULL DEFAULT 0;
