-- phpMyAdmin SQL Dump
-- version 4.0.10deb1
-- http://www.phpmyadmin.net
--
-- Host: localhost
-- Generation Time: Nov 03, 2014 at 09:45 AM
-- Server version: 5.5.40-0ubuntu0.14.04.1
-- PHP Version: 5.5.9-1ubuntu4.5

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

--
-- Database: `arbimon2`
--

-- --------------------------------------------------------

--
-- Table structure for table `classification_results`
--

DROP TABLE IF EXISTS `classification_results`;
CREATE TABLE IF NOT EXISTS `classification_results` (
  `job_id` int(11) NOT NULL,
  `recording_id` int(11) NOT NULL,
  `species_id` int(11) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  `present` tinyint(4) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `classification_stats`
--

DROP TABLE IF EXISTS `classification_stats`;
CREATE TABLE IF NOT EXISTS `classification_stats` (
  `job_id` int(11) NOT NULL,
  `json_stats` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
CREATE TABLE IF NOT EXISTS `jobs` (
  `job_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `job_type_id` int(10) unsigned NOT NULL,
  `date_created` datetime NOT NULL,
  `last_update` datetime NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `uri` varchar(255) NOT NULL,
  `progress` double NOT NULL DEFAULT '0',
  `completed` tinyint(1) NOT NULL DEFAULT '0',
  `remarks` text NOT NULL,
  `progress_steps` int(11) NOT NULL DEFAULT '0',
  `hidden` tinyint(4) NOT NULL,
  PRIMARY KEY (`job_id`),
  KEY `user_id` (`user_id`),
  KEY `project_id` (`project_id`),
  KEY `job_type_id` (`job_type_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=213 ;

-- --------------------------------------------------------

--
-- Table structure for table `job_params_classification`
--

DROP TABLE IF EXISTS `job_params_classification`;
CREATE TABLE IF NOT EXISTS `job_params_classification` (
  `job_id` bigint(20) unsigned NOT NULL,
  `model_id` int(10) unsigned NOT NULL,
  `playlist_id` int(10) unsigned DEFAULT NULL,
  `name` text NOT NULL,
  PRIMARY KEY (`job_id`),
  KEY `playlist_id` (`playlist_id`),
  KEY `model_id` (`model_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `job_params_training`
--

DROP TABLE IF EXISTS `job_params_training`;
CREATE TABLE IF NOT EXISTS `job_params_training` (
  `job_id` bigint(20) unsigned NOT NULL,
  `model_type_id` int(10) unsigned NOT NULL,
  `training_set_id` bigint(20) unsigned NOT NULL,
  `validation_set_id` int(10) unsigned DEFAULT NULL,
  `trained_model_id` int(10) unsigned DEFAULT NULL,
  `use_in_training_present` int(11) NOT NULL,
  `use_in_training_notpresent` int(11) NOT NULL,
  `use_in_validation_present` int(11) NOT NULL,
  `use_in_validation_notpresent` int(11) NOT NULL,
  `name` text NOT NULL,
  PRIMARY KEY (`job_id`),
  KEY `model_type_id` (`model_type_id`),
  KEY `training_set_id` (`training_set_id`),
  KEY `validation_set_id` (`validation_set_id`),
  KEY `trained_model_id` (`trained_model_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `job_types`
--

DROP TABLE IF EXISTS `job_types`;
CREATE TABLE IF NOT EXISTS `job_types` (
  `job_type_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `identifier` varchar(255) NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`job_type_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=4 ;

-- --------------------------------------------------------

--
-- Table structure for table `models`
--

DROP TABLE IF EXISTS `models`;
CREATE TABLE IF NOT EXISTS `models` (
  `model_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `model_type_id` int(10) unsigned NOT NULL,
  `uri` varchar(255) NOT NULL,
  `date_created` datetime NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `training_set_id` bigint(20) unsigned NOT NULL,
  `validation_set_id` int(11) NOT NULL,
  `deleted` tinyint(4) NOT NULL DEFAULT '0',
  PRIMARY KEY (`model_id`),
  KEY `model_type_id` (`model_type_id`),
  KEY `user_id` (`user_id`),
  KEY `project_id` (`project_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=118 ;

-- --------------------------------------------------------

--
-- Table structure for table `model_classes`
--

DROP TABLE IF EXISTS `model_classes`;
CREATE TABLE IF NOT EXISTS `model_classes` (
  `model_id` int(10) unsigned NOT NULL,
  `species_id` int(10) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  PRIMARY KEY (`model_id`,`species_id`,`songtype_id`),
  KEY `species_id` (`species_id`),
  KEY `songtype_id` (`songtype_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `model_stats`
--

DROP TABLE IF EXISTS `model_stats`;
CREATE TABLE IF NOT EXISTS `model_stats` (
  `model_id` int(10) unsigned NOT NULL,
  `json_stats` text NOT NULL,
  UNIQUE KEY `model_id` (`model_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `model_types`
--

DROP TABLE IF EXISTS `model_types`;
CREATE TABLE IF NOT EXISTS `model_types` (
  `model_type_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `training_set_type_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`model_type_id`),
  KEY `training_set_type` (`training_set_type_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=2 ;

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
CREATE TABLE IF NOT EXISTS `permissions` (
  `permission_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `security_level` int(10) unsigned NOT NULL,
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=16 ;

-- --------------------------------------------------------

--
-- Table structure for table `playlists`
--

DROP TABLE IF EXISTS `playlists`;
CREATE TABLE IF NOT EXISTS `playlists` (
  `playlist_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `uri` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`playlist_id`),
  KEY `project_id` (`project_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=45 ;

-- --------------------------------------------------------

--
-- Table structure for table `playlist_recordings`
--

DROP TABLE IF EXISTS `playlist_recordings`;
CREATE TABLE IF NOT EXISTS `playlist_recordings` (
  `playlist_id` int(10) unsigned NOT NULL,
  `recording_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`playlist_id`,`recording_id`),
  KEY `recording_id` (`recording_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
CREATE TABLE IF NOT EXISTS `projects` (
  `project_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `url` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `owner_id` int(10) unsigned NOT NULL,
  `project_type_id` int(10) unsigned NOT NULL,
  `is_private` tinyint(1) NOT NULL,
  `is_enabled` tinyint(4) NOT NULL DEFAULT '1',
  PRIMARY KEY (`project_id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `url` (`url`),
  KEY `owner_id` (`owner_id`),
  KEY `project_type_id` (`project_type_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=12 ;

-- --------------------------------------------------------

--
-- Table structure for table `project_classes`
--

DROP TABLE IF EXISTS `project_classes`;
CREATE TABLE IF NOT EXISTS `project_classes` (
  `project_class_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(11) unsigned NOT NULL,
  `species_id` int(11) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  PRIMARY KEY (`project_class_id`),
  UNIQUE KEY `project_id` (`project_id`,`species_id`,`songtype_id`),
  KEY `species_id` (`species_id`),
  KEY `songtype_id` (`songtype_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=37 ;

-- --------------------------------------------------------

--
-- Table structure for table `project_news`
--

DROP TABLE IF EXISTS `project_news`;
CREATE TABLE IF NOT EXISTS `project_news` (
  `news_feed_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `description` text NOT NULL,
  `news_type_id` int(11) NOT NULL,
  PRIMARY KEY (`news_feed_id`),
  KEY `user_id` (`user_id`),
  KEY `project_id` (`project_id`),
  KEY `news_type_id` (`news_type_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=29 ;

-- --------------------------------------------------------

--
-- Table structure for table `project_news_types`
--

DROP TABLE IF EXISTS `project_news_types`;
CREATE TABLE IF NOT EXISTS `project_news_types` (
  `news_type_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(30) NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`news_type_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=12 ;

-- --------------------------------------------------------

--
-- Table structure for table `project_types`
--

DROP TABLE IF EXISTS `project_types`;
CREATE TABLE IF NOT EXISTS `project_types` (
  `project_type_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`project_type_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=2 ;

-- --------------------------------------------------------

--
-- Table structure for table `recordings`
--

DROP TABLE IF EXISTS `recordings`;
CREATE TABLE IF NOT EXISTS `recordings` (
  `recording_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `site_id` int(10) unsigned NOT NULL,
  `uri` varchar(255) NOT NULL,
  `datetime` datetime NOT NULL,
  `mic` varchar(255) NOT NULL,
  `recorder` varchar(255) NOT NULL,
  `version` varchar(255) NOT NULL,
  PRIMARY KEY (`recording_id`),
  UNIQUE KEY `unique_uri` (`uri`),
  KEY `site_id` (`site_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=715 ;

-- --------------------------------------------------------

--
-- Table structure for table `recording_validations`
--

DROP TABLE IF EXISTS `recording_validations`;
CREATE TABLE IF NOT EXISTS `recording_validations` (
  `recording_validation_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `recording_id` bigint(20) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `species_id` int(11) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  `present` tinyint(1) NOT NULL,
  PRIMARY KEY (`recording_validation_id`),
  UNIQUE KEY `recording_id_2` (`recording_id`,`species_id`,`songtype_id`),
  KEY `recording_id` (`recording_id`),
  KEY `user_id` (`user_id`),
  KEY `species_id` (`species_id`),
  KEY `songtype_id` (`songtype_id`),
  KEY `project_id` (`project_id`),
  KEY `project_id_2` (`project_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=96 ;

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
CREATE TABLE IF NOT EXISTS `roles` (
  `role_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `icon` varchar(64) NOT NULL,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=7 ;

-- --------------------------------------------------------

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role_id` int(10) unsigned NOT NULL,
  `permission_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `permission_id` (`permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` varchar(255) COLLATE utf8_bin NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` text COLLATE utf8_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

-- --------------------------------------------------------

--
-- Table structure for table `sites`
--

DROP TABLE IF EXISTS `sites`;
CREATE TABLE IF NOT EXISTS `sites` (
  `site_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `lat` double NOT NULL,
  `lon` double NOT NULL,
  `alt` double NOT NULL,
  `site_type_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`site_id`),
  KEY `project_id` (`project_id`),
  KEY `site_type_id` (`site_type_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=52 ;

-- --------------------------------------------------------

--
-- Table structure for table `site_types`
--

DROP TABLE IF EXISTS `site_types`;
CREATE TABLE IF NOT EXISTS `site_types` (
  `site_type_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(40) NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`site_type_id`),
  KEY `type` (`name`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=3 ;

-- --------------------------------------------------------

--
-- Table structure for table `songtypes`
--

DROP TABLE IF EXISTS `songtypes`;
CREATE TABLE IF NOT EXISTS `songtypes` (
  `songtype_id` int(11) NOT NULL AUTO_INCREMENT,
  `songtype` varchar(20) NOT NULL,
  `description` varchar(255) NOT NULL,
  PRIMARY KEY (`songtype_id`),
  UNIQUE KEY `songtype` (`songtype`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=10 ;

-- --------------------------------------------------------

--
-- Table structure for table `species`
--

DROP TABLE IF EXISTS `species`;
CREATE TABLE IF NOT EXISTS `species` (
  `species_id` int(11) NOT NULL AUTO_INCREMENT,
  `scientific_name` varchar(100) NOT NULL,
  `code_name` varchar(10) NOT NULL,
  `taxon_id` int(11) NOT NULL,
  `family_id` int(11) DEFAULT NULL,
  `image` varchar(200) DEFAULT NULL,
  `description` text,
  `biotab_id` int(11) DEFAULT NULL,
  `defined_by` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`species_id`),
  UNIQUE KEY `scientific_name` (`scientific_name`),
  KEY `taxon_id` (`taxon_id`),
  KEY `code_name` (`code_name`),
  KEY `biotab_id` (`biotab_id`),
  KEY `family_id` (`family_id`),
  KEY `defined_by` (`defined_by`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=16769 ;

-- --------------------------------------------------------

--
-- Table structure for table `species_aliases`
--

DROP TABLE IF EXISTS `species_aliases`;
CREATE TABLE IF NOT EXISTS `species_aliases` (
  `alias_id` int(11) NOT NULL AUTO_INCREMENT,
  `species_id` int(11) NOT NULL,
  `alias` varchar(50) NOT NULL,
  PRIMARY KEY (`alias_id`),
  KEY `species_id` (`species_id`),
  KEY `alias` (`alias`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=10540 ;

-- --------------------------------------------------------

--
-- Table structure for table `species_families`
--

DROP TABLE IF EXISTS `species_families`;
CREATE TABLE IF NOT EXISTS `species_families` (
  `family_id` int(11) NOT NULL AUTO_INCREMENT,
  `family` varchar(300) NOT NULL,
  `taxon_id` int(11) NOT NULL,
  PRIMARY KEY (`family_id`),
  KEY `taxon_id` (`taxon_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=272 ;

-- --------------------------------------------------------

--
-- Table structure for table `species_taxons`
--

DROP TABLE IF EXISTS `species_taxons`;
CREATE TABLE IF NOT EXISTS `species_taxons` (
  `taxon_id` int(11) NOT NULL AUTO_INCREMENT,
  `taxon` varchar(30) NOT NULL,
  `image` varchar(30) NOT NULL,
  `taxon_order` int(11) NOT NULL,
  `enabled` tinyint(11) NOT NULL,
  PRIMARY KEY (`taxon_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=9 ;

-- --------------------------------------------------------

--
-- Table structure for table `training_sets`
--

DROP TABLE IF EXISTS `training_sets`;
CREATE TABLE IF NOT EXISTS `training_sets` (
  `training_set_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `date_created` date NOT NULL,
  `training_set_type_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`training_set_id`),
  UNIQUE KEY `project_id_2` (`project_id`,`name`),
  KEY `project_id` (`project_id`),
  KEY `training_set_type_id` (`training_set_type_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=24 ;

-- --------------------------------------------------------

--
-- Table structure for table `training_sets_roi_set`
--

DROP TABLE IF EXISTS `training_sets_roi_set`;
CREATE TABLE IF NOT EXISTS `training_sets_roi_set` (
  `training_set_id` bigint(20) unsigned NOT NULL,
  `species_id` int(11) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  PRIMARY KEY (`training_set_id`),
  KEY `species_id` (`species_id`),
  KEY `songtype_id` (`songtype_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `training_set_roi_set_data`
--

DROP TABLE IF EXISTS `training_set_roi_set_data`;
CREATE TABLE IF NOT EXISTS `training_set_roi_set_data` (
  `roi_set_data_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `training_set_id` bigint(20) unsigned NOT NULL,
  `recording_id` bigint(20) unsigned NOT NULL,
  `species_id` int(11) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  `x1` double NOT NULL COMMENT 'initial time in seconds',
  `y1` double NOT NULL COMMENT 'min frequency in hertz',
  `x2` double NOT NULL COMMENT 'final time in seconds',
  `y2` double NOT NULL COMMENT 'max frequency in hertz',
  PRIMARY KEY (`roi_set_data_id`),
  KEY `recording_id` (`recording_id`),
  KEY `training_set_id` (`training_set_id`),
  KEY `species_id` (`species_id`),
  KEY `songtype_id` (`songtype_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=58 ;

-- --------------------------------------------------------

--
-- Table structure for table `training_set_types`
--

DROP TABLE IF EXISTS `training_set_types`;
CREATE TABLE IF NOT EXISTS `training_set_types` (
  `training_set_type_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `identifier` varchar(255) NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`training_set_type_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=2 ;

-- --------------------------------------------------------

--
-- Table structure for table `uploaded_recordings`
--

DROP TABLE IF EXISTS `uploaded_recordings`;
CREATE TABLE IF NOT EXISTS `uploaded_recordings` (
  `uploaded_recording_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `filename` varchar(120) NOT NULL COMMENT 'filename of the recording',
  `project_id` int(11) unsigned NOT NULL,
  `site_id` int(11) unsigned NOT NULL,
  `datetime` datetime DEFAULT NULL,
  `state` varchar(20) DEFAULT NULL,
  `remarks` text,
  `upload_timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `upload_user_id` int(11) unsigned NOT NULL,
  PRIMARY KEY (`uploaded_recording_id`),
  KEY `current_state_id` (`state`(1)),
  KEY `recording` (`filename`),
  KEY `project_id_upload_time` (`project_id`,`upload_timestamp`),
  KEY `project_id` (`project_id`),
  KEY `site_id` (`site_id`),
  KEY `upload_user_id` (`upload_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1 ;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `user_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `login` varchar(32) NOT NULL,
  `password` varchar(64) NOT NULL,
  `firstname` varchar(255) NOT NULL,
  `lastname` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `last_login` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_super` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `login` (`login`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=6 ;

-- --------------------------------------------------------

--
-- Table structure for table `user_account_support_request`
--

DROP TABLE IF EXISTS `user_account_support_request`;
CREATE TABLE IF NOT EXISTS `user_account_support_request` (
  `support_request_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `support_type_id` int(10) unsigned NOT NULL,
  `hash` varchar(64) NOT NULL,
  `params` text NOT NULL,
  `consumed` tinyint(1) NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `expires` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`support_request_id`),
  KEY `user_id` (`user_id`),
  KEY `support_type_id` (`support_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1 ;

-- --------------------------------------------------------

--
-- Table structure for table `user_account_support_type`
--

DROP TABLE IF EXISTS `user_account_support_type`;
CREATE TABLE IF NOT EXISTS `user_account_support_type` (
  `account_support_type_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `max_lifetime` int(11) DEFAULT NULL COMMENT 'maximum lifetime in seconds of this support type',
  PRIMARY KEY (`account_support_type_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=3 ;

-- --------------------------------------------------------

--
-- Table structure for table `user_project_role`
--

DROP TABLE IF EXISTS `user_project_role`;
CREATE TABLE IF NOT EXISTS `user_project_role` (
  `user_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `role_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`user_id`,`project_id`),
  KEY `project_id` (`project_id`),
  KEY `role_id` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `validation_set`
--

DROP TABLE IF EXISTS `validation_set`;
CREATE TABLE IF NOT EXISTS `validation_set` (
  `validation_set_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `uri` varchar(255) NOT NULL,
  `params` text NOT NULL,
  `job_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`validation_set_id`),
  KEY `job_id` (`job_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=170 ;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `jobs`
--
ALTER TABLE `jobs`
  ADD CONSTRAINT `jobs_ibfk_1` FOREIGN KEY (`job_type_id`) REFERENCES `job_types` (`job_type_id`),
  ADD CONSTRAINT `jobs_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `jobs_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `job_params_classification`
--
ALTER TABLE `job_params_classification`
  ADD CONSTRAINT `job_params_classification_ibfk_1` FOREIGN KEY (`model_id`) REFERENCES `models` (`model_id`),
  ADD CONSTRAINT `job_params_classification_ibfk_2` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`playlist_id`),
  ADD CONSTRAINT `job_params_classification_ibfk_3` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`) ON DELETE CASCADE;

--
-- Constraints for table `job_params_training`
--
ALTER TABLE `job_params_training`
  ADD CONSTRAINT `job_params_training_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `job_params_training_ibfk_2` FOREIGN KEY (`model_type_id`) REFERENCES `model_types` (`model_type_id`),
  ADD CONSTRAINT `job_params_training_ibfk_3` FOREIGN KEY (`training_set_id`) REFERENCES `training_sets` (`training_set_id`),
  ADD CONSTRAINT `job_params_training_ibfk_4` FOREIGN KEY (`validation_set_id`) REFERENCES `validation_set` (`validation_set_id`),
  ADD CONSTRAINT `job_params_training_ibfk_5` FOREIGN KEY (`trained_model_id`) REFERENCES `models` (`model_id`);

--
-- Constraints for table `models`
--
ALTER TABLE `models`
  ADD CONSTRAINT `models_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`),
  ADD CONSTRAINT `models_ibfk_1` FOREIGN KEY (`model_type_id`) REFERENCES `model_types` (`model_type_id`),
  ADD CONSTRAINT `models_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `model_classes`
--
ALTER TABLE `model_classes`
  ADD CONSTRAINT `model_classes_ibfk_1` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`),
  ADD CONSTRAINT `model_classes_ibfk_2` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`),
  ADD CONSTRAINT `model_classes_ibfk_3` FOREIGN KEY (`model_id`) REFERENCES `models` (`model_id`);

--
-- Constraints for table `model_stats`
--
ALTER TABLE `model_stats`
  ADD CONSTRAINT `model_stats_ibfk_1` FOREIGN KEY (`model_id`) REFERENCES `models` (`model_id`);

--
-- Constraints for table `model_types`
--
ALTER TABLE `model_types`
  ADD CONSTRAINT `model_types_ibfk_1` FOREIGN KEY (`training_set_type_id`) REFERENCES `training_set_types` (`training_set_type_id`);

--
-- Constraints for table `playlist_recordings`
--
ALTER TABLE `playlist_recordings`
  ADD CONSTRAINT `playlist_recordings_ibfk_1` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`playlist_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `playlist_recordings_ibfk_2` FOREIGN KEY (`recording_id`) REFERENCES `recordings` (`recording_id`) ON DELETE CASCADE;

--
-- Constraints for table `projects`
--
ALTER TABLE `projects`
  ADD CONSTRAINT `projects_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `projects_ibfk_2` FOREIGN KEY (`project_type_id`) REFERENCES `project_types` (`project_type_id`);

--
-- Constraints for table `project_classes`
--
ALTER TABLE `project_classes`
  ADD CONSTRAINT `project_classes_ibfk_1` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `project_classes_ibfk_2` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `project_classes_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE;

--
-- Constraints for table `project_news`
--
ALTER TABLE `project_news`
  ADD CONSTRAINT `project_news_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `project_news_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`),
  ADD CONSTRAINT `project_news_ibfk_3` FOREIGN KEY (`news_type_id`) REFERENCES `project_news_types` (`news_type_id`);

--
-- Constraints for table `recordings`
--
ALTER TABLE `recordings`
  ADD CONSTRAINT `recordings_ibfk_1` FOREIGN KEY (`site_id`) REFERENCES `sites` (`site_id`);

--
-- Constraints for table `recording_validations`
--
ALTER TABLE `recording_validations`
  ADD CONSTRAINT `recording_validations_ibfk_8` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`),
  ADD CONSTRAINT `recording_validations_ibfk_2` FOREIGN KEY (`recording_id`) REFERENCES `recordings` (`recording_id`),
  ADD CONSTRAINT `recording_validations_ibfk_5` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `recording_validations_ibfk_6` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`),
  ADD CONSTRAINT `recording_validations_ibfk_7` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`);

--
-- Constraints for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`permission_id`) ON DELETE CASCADE;

--
-- Constraints for table `sites`
--
ALTER TABLE `sites`
  ADD CONSTRAINT `sites_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sites_ibfk_2` FOREIGN KEY (`site_type_id`) REFERENCES `site_types` (`site_type_id`);

--
-- Constraints for table `species`
--
ALTER TABLE `species`
  ADD CONSTRAINT `species_ibfk_1` FOREIGN KEY (`taxon_id`) REFERENCES `species_taxons` (`taxon_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `species_ibfk_2` FOREIGN KEY (`family_id`) REFERENCES `species_families` (`family_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `species_ibfk_3` FOREIGN KEY (`defined_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `species_aliases`
--
ALTER TABLE `species_aliases`
  ADD CONSTRAINT `species_aliases_ibfk_1` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `species_families`
--
ALTER TABLE `species_families`
  ADD CONSTRAINT `species_families_ibfk_1` FOREIGN KEY (`taxon_id`) REFERENCES `species_taxons` (`taxon_id`) ON DELETE CASCADE;

--
-- Constraints for table `training_sets`
--
ALTER TABLE `training_sets`
  ADD CONSTRAINT `training_sets_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `training_sets_ibfk_2` FOREIGN KEY (`training_set_type_id`) REFERENCES `training_set_types` (`training_set_type_id`);

--
-- Constraints for table `training_sets_roi_set`
--
ALTER TABLE `training_sets_roi_set`
  ADD CONSTRAINT `training_sets_roi_set_ibfk_1` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`),
  ADD CONSTRAINT `training_sets_roi_set_ibfk_2` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`),
  ADD CONSTRAINT `training_sets_roi_set_ibfk_3` FOREIGN KEY (`training_set_id`) REFERENCES `training_sets` (`training_set_id`) ON DELETE CASCADE;

--
-- Constraints for table `training_set_roi_set_data`
--
ALTER TABLE `training_set_roi_set_data`
  ADD CONSTRAINT `training_set_roi_set_data_ibfk_1` FOREIGN KEY (`training_set_id`) REFERENCES `training_sets` (`training_set_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `training_set_roi_set_data_ibfk_2` FOREIGN KEY (`recording_id`) REFERENCES `recordings` (`recording_id`),
  ADD CONSTRAINT `training_set_roi_set_data_ibfk_3` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`),
  ADD CONSTRAINT `training_set_roi_set_data_ibfk_4` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`);

--
-- Constraints for table `uploaded_recordings`
--
ALTER TABLE `uploaded_recordings`
  ADD CONSTRAINT `uploaded_recordings_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`),
  ADD CONSTRAINT `uploaded_recordings_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `sites` (`site_id`),
  ADD CONSTRAINT `uploaded_recordings_ibfk_3` FOREIGN KEY (`upload_user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `user_account_support_request`
--
ALTER TABLE `user_account_support_request`
  ADD CONSTRAINT `user_account_support_request_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_account_support_request_ibfk_2` FOREIGN KEY (`support_type_id`) REFERENCES `user_account_support_type` (`account_support_type_id`) ON DELETE CASCADE;

--
-- Constraints for table `user_project_role`
--
ALTER TABLE `user_project_role`
  ADD CONSTRAINT `user_project_role_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_project_role_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_project_role_ibfk_3` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`);

--
-- Constraints for table `validation_set`
--
ALTER TABLE `validation_set`
  ADD CONSTRAINT `validation_set_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`);
