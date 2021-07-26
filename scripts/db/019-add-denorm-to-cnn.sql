ALTER TABLE `arbimon2`.`cnn_results_rois`
ADD COLUMN `denorm_site_id` int(10) unsigned DEFAULT NULL,
ADD FOREIGN KEY fk_cnn_results_rois_denorm_site_id(denorm_site_id) REFERENCES sites(site_id) ON DELETE CASCADE;

ALTER TABLE `arbimon2`.`cnn_results_rois`
ADD COLUMN `denorm_recording_datetime` datetime DEFAULT NULL;

ALTER TABLE `arbimon2`.`cnn_results_rois`
ADD COLUMN `denorm_recording_date` date DEFAULT NULL;

UPDATE `arbimon2`.`cnn_results_rois` CNNR
JOIN recordings AS R ON R.recording_id = CNNR.recording_id
SET CNNR.denorm_site_id = R.site_id, CNNR.denorm_recording_datetime = R.datetime, CNNR.denorm_recording_date = DATE(R.datetime);

CREATE INDEX denorm_site_id ON cnn_results_rois(denorm_site_id);
CREATE INDEX job_id_site_date_score ON cnn_results_rois(job_id, denorm_site_id, denorm_recording_date, score);
