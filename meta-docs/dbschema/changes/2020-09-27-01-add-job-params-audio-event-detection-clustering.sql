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
)

