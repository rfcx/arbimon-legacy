CREATE TABLE `templates` (
  `template_id` int(11) NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `recording_id` bigint(20) unsigned NOT NULL,
  `species_id` int(11) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `uri` varchar(255) DEFAULT NULL,
  `x1` double NOT NULL,
  `y1` double NOT NULL,
  `x2` double NOT NULL,
  `y2` double NOT NULL,
  `date_created` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`template_id`),
  KEY `fk_templates_1_idx` (`project_id`),
  KEY `fk_templates_2_idx` (`recording_id`),
  KEY `fk_templates_3_idx` (`species_id`),
  KEY `fk_templates_4_idx` (`songtype_id`),
  CONSTRAINT `fk_templates_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_templates_2` FOREIGN KEY (`recording_id`) REFERENCES `recordings` (`recording_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_templates_3` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_templates_4` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=latin1;


CREATE TABLE `job_params_pattern_matching` (
  `job_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `playlist_id` int(10) unsigned NOT NULL,
  `template_id` int(11) NOT NULL,
  `params` text NOT NULL,
  PRIMARY KEY (`job_id`),
  KEY `fk_job_params_pattern_matching_2_idx` (`playlist_id`),
  KEY `fk_job_params_pattern_matching_3_idx` (`template_id`),
  CONSTRAINT `fk_job_params_pattern_matching_3` FOREIGN KEY (`template_id`) REFERENCES `templates` (`template_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_job_params_pattern_matching_1` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_job_params_pattern_matching_2` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`playlist_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;


CREATE TABLE `pattern_matchings` (
  `pattern_matching_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `timestamp` timestamp NOT NULL,
  `species_id` int(11) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  `parameters` text NOT NULL,
  `playlist_id` int(10) unsigned NOT NULL,
  `template_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`pattern_matching_id`),
  KEY `fk_pattern_matchings_1_idx` (`species_id`),
  KEY `fk_pattern_matchings_2_idx` (`songtype_id`),
  KEY `fk_pattern_matchings_3_idx` (`playlist_id`),
  KEY `fk_pattern_matchings_5_idx` (`project_id`),
  CONSTRAINT `fk_pattern_matchings_1` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pattern_matchings_2` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pattern_matchings_3` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`playlist_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pattern_matchings_5` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1;


CREATE TABLE `pattern_matching_rois` (
  `pattern_matching_roi_id` int(11) NOT NULL AUTO_INCREMENT,
  `pattern_matching_id` int(11) NOT NULL,
  `recording_id` bigint(20) unsigned NOT NULL,
  `species_id` int(11) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  `x1` double NOT NULL,
  `y1` double NOT NULL,
  `x2` double NOT NULL,
  `y2` double NOT NULL,
  `uri` text NOT NULL,
  `validated` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`pattern_matching_roi_id`),
  KEY `fk_pattern_matching_matches_1_idx` (`pattern_matching_id`),
  KEY `fk_pattern_matching_matches_2_idx` (`recording_id`),
  KEY `fk_pattern_matching_matches_3_idx` (`species_id`),
  KEY `fk_pattern_matching_matches_4_idx` (`songtype_id`),
  CONSTRAINT `fk_pattern_matching_matches_1` FOREIGN KEY (`pattern_matching_id`) REFERENCES `pattern_matchings` (`pattern_matching_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pattern_matching_matches_2` FOREIGN KEY (`recording_id`) REFERENCES `recordings` (`recording_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pattern_matching_matches_3` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pattern_matching_matches_4` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=latin1;
