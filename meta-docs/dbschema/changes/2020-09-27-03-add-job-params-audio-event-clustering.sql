CREATE TABLE `job_params_audio_event_clustering` (
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
)
