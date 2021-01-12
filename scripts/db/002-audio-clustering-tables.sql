CREATE TABLE `job_params_audio_event_detection_clustering` (
  `job_id` BIGINT(20) UNSIGNED NOT NULL,
  `name` text NOT NULL,
  `project_id` INT(10) UNSIGNED NOT NULL,
  `user_id` INT(10) UNSIGNED NOT NULL,
  `playlist_id` INT(10) UNSIGNED NOT NULL,
  `date_created` DATETIME NOT NULL,
  `parameters` VARCHAR(255) NOT NULL,
  KEY `job_id` (`job_id`),
  KEY `user_id` (`user_id`),
  KEY `project_id` (`project_id`),
  KEY `playlist_id` (`playlist_id`),
  CONSTRAINT `job_params_cl_ifbk_1` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`) ON DELETE CASCADE,
  CONSTRAINT `job_params_cl_ifbk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `job_params_cl_ifbk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  CONSTRAINT `job_params_cl_ifbk_4` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`playlist_id`) ON DELETE CASCADE
);

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
);

CREATE TABLE `job_params_audio_event_clustering` (
  `name` VARCHAR(255) NOT NULL,
  `job_id` BIGINT(20) UNSIGNED NOT NULL,
  `project_id` INT(10) UNSIGNED NOT NULL,
  `user_id` INT(10) UNSIGNED NOT NULL,
  `audio_event_detection_job_id` BIGINT(20) UNSIGNED NOT NULL,
  `date_created` DATETIME NOT NULL,
  `parameters` VARCHAR(255) NOT NULL,
  KEY `job_id` (`job_id`),
  KEY `user_id` (`user_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `job_params_aud_ev_cl_ifbk_1` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`),
  CONSTRAINT `job_params_aud_ev_cl_ifbk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `job_params_aud_ev_cl_ifbk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`)
);

CREATE TABLE `playlist_aed` (
  `playlist_id` INT(10) UNSIGNED NOT NULL,
  `aed_id` BIGINT(20) UNSIGNED NOT NULL,
  KEY `playlist_id` (`playlist_id`),
  KEY `aed_id` (`aed_id`),
  CONSTRAINT `playlist_id` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`playlist_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `aed_id` FOREIGN KEY (`aed_id`) REFERENCES `audio_event_detections_clustering` (`aed_id`) ON DELETE CASCADE ON UPDATE CASCADE
);
