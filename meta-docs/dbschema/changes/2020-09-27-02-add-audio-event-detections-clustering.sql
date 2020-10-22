CREATE TABLE `audio_event_detections_clustering` (
  `aed_id` BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `job_id` BIGINT(20) UNSIGNED NOT NULL,
  `recording_id` BIGINT(20) UNSIGNED NOT NULL,
  `time_min` FLOAT NOT NULL,
  `time_max` FLOAT NOT NULL,
  `frequency_min` FLOAT NOT NULL,
  `frequency_max` FLOAT NOT NULL,
  `cluster_number` BIGINT(20) UNSIGNED NOT NULL,
  `uri_image` VARCHAR(255) NOT NULL,
  `uri_vector` VARCHAR(255) NOT NULL,
  KEY `job_id` (`job_id`),
  KEY `recording_id` (`recording_id`),
  CONSTRAINT `audio_ev_det_cl_ifbk_1` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`) ON DELETE CASCADE,
  CONSTRAINT `audio_ev_det_cl_ifbk_2` FOREIGN KEY (`recording_id`) REFERENCES `recordings` (`recording_id`) ON DELETE CASCADE
)
