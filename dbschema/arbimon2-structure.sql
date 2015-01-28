-- MySQL dump 10.13  Distrib 5.5.41, for debian-linux-gnu (x86_64)
--
-- Host: 10.0.0.4    Database: arbimon2
-- ------------------------------------------------------
-- Server version	5.5.41-0ubuntu0.14.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `classification_results`
--

DROP TABLE IF EXISTS `classification_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `classification_results` (
  `job_id` int(11) NOT NULL,
  `recording_id` int(11) NOT NULL,
  `species_id` int(11) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  `present` tinyint(4) NOT NULL,
  `max_vector_value` float DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `classification_stats`
--

DROP TABLE IF EXISTS `classification_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `classification_stats` (
  `job_id` int(11) NOT NULL,
  `json_stats` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invalid_logins`
--

DROP TABLE IF EXISTS `invalid_logins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `invalid_logins` (
  `ip` text NOT NULL,
  `time` bigint(11) NOT NULL,
  `user` text NOT NULL,
  `reason` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_params_classification`
--

DROP TABLE IF EXISTS `job_params_classification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `job_params_classification` (
  `job_id` bigint(20) unsigned NOT NULL,
  `model_id` int(10) unsigned NOT NULL,
  `playlist_id` int(10) unsigned DEFAULT NULL,
  `name` text NOT NULL,
  PRIMARY KEY (`job_id`),
  KEY `playlist_id` (`playlist_id`),
  KEY `model_id` (`model_id`),
  CONSTRAINT `job_params_classification_ibfk_1` FOREIGN KEY (`model_id`) REFERENCES `models` (`model_id`),
  CONSTRAINT `job_params_classification_ibfk_2` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`playlist_id`) ON DELETE SET NULL,
  CONSTRAINT `job_params_classification_ibfk_3` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_params_soundscape`
--

DROP TABLE IF EXISTS `job_params_soundscape`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `job_params_soundscape` (
  `job_id` bigint(11) unsigned NOT NULL,
  `playlist_id` int(10) unsigned NOT NULL,
  `max_hertz` int(11) NOT NULL,
  `bin_size` int(11) NOT NULL,
  `soundscape_aggregation_type_id` int(10) unsigned NOT NULL,
  `name` text NOT NULL,
  `threshold` float NOT NULL DEFAULT '0',
  `frequency` int(11) NOT NULL DEFAULT '0',
  UNIQUE KEY `job_id` (`job_id`),
  KEY `playlist_id` (`playlist_id`),
  KEY `soundscape_aggregation_type_id` (`soundscape_aggregation_type_id`),
  CONSTRAINT `job_params_soundscape_ibfk_1` FOREIGN KEY (`soundscape_aggregation_type_id`) REFERENCES `soundscape_aggregation_types` (`soundscape_aggregation_type_id`),
  CONSTRAINT `job_params_soundscape_ibfk_2` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`) ON DELETE CASCADE,
  CONSTRAINT `job_params_soundscape_ibfk_3` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`playlist_id`) ON DELETE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_params_training`
--

DROP TABLE IF EXISTS `job_params_training`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `job_params_training` (
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
  KEY `trained_model_id` (`trained_model_id`),
  CONSTRAINT `job_params_training_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`),
  CONSTRAINT `job_params_training_ibfk_2` FOREIGN KEY (`model_type_id`) REFERENCES `model_types` (`model_type_id`),
  CONSTRAINT `job_params_training_ibfk_3` FOREIGN KEY (`training_set_id`) REFERENCES `training_sets` (`training_set_id`),
  CONSTRAINT `job_params_training_ibfk_4` FOREIGN KEY (`validation_set_id`) REFERENCES `validation_set` (`validation_set_id`),
  CONSTRAINT `job_params_training_ibfk_5` FOREIGN KEY (`trained_model_id`) REFERENCES `models` (`model_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_queue_enqueued_jobs`
--

DROP TABLE IF EXISTS `job_queue_enqueued_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `job_queue_enqueued_jobs` (
  `enqueued_job_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `job_queue_id` int(11) NOT NULL,
  `job_id` bigint(20) unsigned NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`enqueued_job_id`),
  UNIQUE KEY `job_id` (`job_id`),
  KEY `job_queue_id` (`job_queue_id`),
  CONSTRAINT `job_queue_enqueued_jobs_ibfk_1` FOREIGN KEY (`job_queue_id`) REFERENCES `job_queues` (`job_queue_id`) ON DELETE CASCADE,
  CONSTRAINT `job_queue_enqueued_jobs_ibfk_2` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_queues`
--

DROP TABLE IF EXISTS `job_queues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `job_queues` (
  `job_queue_id` int(11) NOT NULL AUTO_INCREMENT,
  `pid` int(11) NOT NULL,
  `host` varchar(256) NOT NULL,
  `platform` varchar(255) NOT NULL,
  `arch` varchar(255) NOT NULL,
  `cpus` int(11) NOT NULL,
  `freemem` int(11) NOT NULL,
  `heartbeat` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_alive` tinyint(1) NOT NULL,
  PRIMARY KEY (`job_queue_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_types`
--

DROP TABLE IF EXISTS `job_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `job_types` (
  `job_type_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `identifier` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `enabled` int(11) NOT NULL,
  `script` varchar(255) NOT NULL,
  PRIMARY KEY (`job_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `jobs` (
  `job_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `job_type_id` int(10) unsigned NOT NULL,
  `date_created` datetime NOT NULL,
  `last_update` datetime NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `uri` varchar(255) NOT NULL,
  `state` enum('waiting','initializing','ready','processing','completed','error','canceled','stalled') NOT NULL DEFAULT 'waiting',
  `cancel_requested` int(11) NOT NULL DEFAULT '0',
  `progress` double NOT NULL DEFAULT '0',
  `completed` tinyint(1) NOT NULL DEFAULT '0',
  `remarks` text NOT NULL,
  `progress_steps` int(11) NOT NULL DEFAULT '0',
  `hidden` tinyint(4) NOT NULL,
  PRIMARY KEY (`job_id`),
  KEY `user_id` (`user_id`),
  KEY `project_id` (`project_id`),
  KEY `job_type_id` (`job_type_id`),
  KEY `state` (`state`),
  CONSTRAINT `jobs_ibfk_1` FOREIGN KEY (`job_type_id`) REFERENCES `job_types` (`job_type_id`),
  CONSTRAINT `jobs_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  CONSTRAINT `jobs_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `model_classes`
--

DROP TABLE IF EXISTS `model_classes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `model_classes` (
  `model_id` int(10) unsigned NOT NULL,
  `species_id` int(10) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  PRIMARY KEY (`model_id`,`species_id`,`songtype_id`),
  KEY `species_id` (`species_id`),
  KEY `songtype_id` (`songtype_id`),
  CONSTRAINT `model_classes_ibfk_1` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`),
  CONSTRAINT `model_classes_ibfk_2` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`),
  CONSTRAINT `model_classes_ibfk_3` FOREIGN KEY (`model_id`) REFERENCES `models` (`model_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `model_stats`
--

DROP TABLE IF EXISTS `model_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `model_stats` (
  `model_id` int(10) unsigned NOT NULL,
  `json_stats` text NOT NULL,
  UNIQUE KEY `model_id` (`model_id`),
  CONSTRAINT `model_stats_ibfk_1` FOREIGN KEY (`model_id`) REFERENCES `models` (`model_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `model_types`
--

DROP TABLE IF EXISTS `model_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `model_types` (
  `model_type_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `training_set_type_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`model_type_id`),
  KEY `training_set_type` (`training_set_type_id`),
  CONSTRAINT `model_types_ibfk_1` FOREIGN KEY (`training_set_type_id`) REFERENCES `training_set_types` (`training_set_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `models`
--

DROP TABLE IF EXISTS `models`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `models` (
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
  `threshold` float DEFAULT NULL,
  PRIMARY KEY (`model_id`),
  KEY `model_type_id` (`model_type_id`),
  KEY `user_id` (`user_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `models_ibfk_1` FOREIGN KEY (`model_type_id`) REFERENCES `model_types` (`model_type_id`),
  CONSTRAINT `models_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `models_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permissions` (
  `permission_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `security_level` int(10) unsigned NOT NULL,
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `playlist_recordings`
--

DROP TABLE IF EXISTS `playlist_recordings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `playlist_recordings` (
  `playlist_id` int(10) unsigned NOT NULL,
  `recording_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`playlist_id`,`recording_id`),
  KEY `recording_id` (`recording_id`),
  CONSTRAINT `playlist_recordings_ibfk_1` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`playlist_id`) ON DELETE CASCADE,
  CONSTRAINT `playlist_recordings_ibfk_2` FOREIGN KEY (`recording_id`) REFERENCES `recordings` (`recording_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `playlist_types`
--

DROP TABLE IF EXISTS `playlist_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `playlist_types` (
  `playlist_type_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`playlist_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `playlists`
--

DROP TABLE IF EXISTS `playlists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `playlists` (
  `playlist_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `playlist_type_id` int(10) unsigned NOT NULL,
  `uri` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`playlist_id`),
  UNIQUE KEY `project_id_2` (`project_id`,`name`),
  KEY `project_id` (`project_id`),
  KEY `playlist_type_id` (`playlist_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_classes`
--

DROP TABLE IF EXISTS `project_classes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `project_classes` (
  `project_class_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(11) unsigned NOT NULL,
  `species_id` int(11) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  PRIMARY KEY (`project_class_id`),
  UNIQUE KEY `project_id` (`project_id`,`species_id`,`songtype_id`),
  KEY `species_id` (`species_id`),
  KEY `songtype_id` (`songtype_id`),
  CONSTRAINT `project_classes_ibfk_1` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`) ON DELETE CASCADE,
  CONSTRAINT `project_classes_ibfk_2` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`) ON DELETE CASCADE,
  CONSTRAINT `project_classes_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_imported_sites`
--

DROP TABLE IF EXISTS `project_imported_sites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `project_imported_sites` (
  `site_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`site_id`,`project_id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `project_imported_sites_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `project_imported_sites_ibfk_1` FOREIGN KEY (`site_id`) REFERENCES `sites` (`site_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='published sites added to projects';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_news`
--

DROP TABLE IF EXISTS `project_news`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `project_news` (
  `news_feed_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `data` text NOT NULL,
  `news_type_id` int(11) NOT NULL,
  PRIMARY KEY (`news_feed_id`),
  KEY `user_id` (`user_id`),
  KEY `project_id` (`project_id`),
  KEY `news_type_id` (`news_type_id`),
  KEY `timestamp` (`timestamp`),
  CONSTRAINT `project_news_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `project_news_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`),
  CONSTRAINT `project_news_ibfk_3` FOREIGN KEY (`news_type_id`) REFERENCES `project_news_types` (`news_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_news_types`
--

DROP TABLE IF EXISTS `project_news_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `project_news_types` (
  `news_type_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(30) NOT NULL,
  `description` text NOT NULL,
  `message_format` text NOT NULL,
  PRIMARY KEY (`news_type_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_types`
--

DROP TABLE IF EXISTS `project_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `project_types` (
  `project_type_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`project_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `projects` (
  `project_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `url` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `owner_id` int(10) unsigned NOT NULL,
  `project_type_id` int(10) unsigned NOT NULL,
  `is_private` tinyint(1) NOT NULL,
  `is_enabled` tinyint(4) NOT NULL DEFAULT '1',
  `recording_limit` int(10) unsigned NOT NULL DEFAULT '50000',
  PRIMARY KEY (`project_id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `url` (`url`),
  KEY `owner_id` (`owner_id`),
  KEY `project_type_id` (`project_type_id`),
  CONSTRAINT `projects_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `projects_ibfk_2` FOREIGN KEY (`project_type_id`) REFERENCES `project_types` (`project_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `recording_validations`
--

DROP TABLE IF EXISTS `recording_validations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `recording_validations` (
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
  KEY `project_id_2` (`project_id`),
  CONSTRAINT `recording_validations_ibfk_2` FOREIGN KEY (`recording_id`) REFERENCES `recordings` (`recording_id`),
  CONSTRAINT `recording_validations_ibfk_5` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `recording_validations_ibfk_6` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`),
  CONSTRAINT `recording_validations_ibfk_7` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`),
  CONSTRAINT `recording_validations_ibfk_8` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `recordings`
--

DROP TABLE IF EXISTS `recordings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `recordings` (
  `recording_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `site_id` int(10) unsigned NOT NULL,
  `uri` varchar(255) NOT NULL,
  `datetime` datetime NOT NULL,
  `mic` varchar(255) NOT NULL,
  `recorder` varchar(255) NOT NULL,
  `version` varchar(255) NOT NULL,
  PRIMARY KEY (`recording_id`),
  UNIQUE KEY `unique_uri` (`uri`),
  KEY `site_id` (`site_id`),
  CONSTRAINT `recordings_ibfk_1` FOREIGN KEY (`site_id`) REFERENCES `sites` (`site_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `recordings_errors`
--

DROP TABLE IF EXISTS `recordings_errors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `recordings_errors` (
  `recording_id` int(11) NOT NULL,
  `job_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `role_permissions` (
  `role_id` int(10) unsigned NOT NULL,
  `permission_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE,
  CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`permission_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `roles` (
  `role_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `icon` varchar(64) NOT NULL,
  `level` int(11) NOT NULL,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sessions` (
  `session_id` varchar(255) COLLATE utf8_bin NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` text COLLATE utf8_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_types`
--

DROP TABLE IF EXISTS `site_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `site_types` (
  `site_type_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(40) NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`site_type_id`),
  KEY `type` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sites`
--

DROP TABLE IF EXISTS `sites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sites` (
  `site_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `site_type_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `lat` double NOT NULL,
  `lon` double NOT NULL,
  `alt` double NOT NULL,
  `published` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`site_id`),
  KEY `project_id` (`project_id`),
  KEY `site_type_id` (`site_type_id`),
  CONSTRAINT `sites_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  CONSTRAINT `sites_ibfk_2` FOREIGN KEY (`site_type_id`) REFERENCES `site_types` (`site_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `songtypes`
--

DROP TABLE IF EXISTS `songtypes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `songtypes` (
  `songtype_id` int(11) NOT NULL AUTO_INCREMENT,
  `songtype` varchar(20) NOT NULL,
  `description` varchar(255) NOT NULL,
  PRIMARY KEY (`songtype_id`),
  UNIQUE KEY `songtype` (`songtype`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `soundscape_aggregation_types`
--

DROP TABLE IF EXISTS `soundscape_aggregation_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `soundscape_aggregation_types` (
  `soundscape_aggregation_type_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `identifier` varchar(255) NOT NULL,
  `name` text NOT NULL,
  `scale` varchar(50) NOT NULL COMMENT 'json array',
  `description` text NOT NULL,
  PRIMARY KEY (`soundscape_aggregation_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `soundscape_region_tags`
--

DROP TABLE IF EXISTS `soundscape_region_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `soundscape_region_tags` (
  `soundscape_region_tag_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `soundscape_region_id` int(10) unsigned NOT NULL,
  `recording_id` bigint(20) unsigned NOT NULL,
  `soundscape_tag_id` int(11) unsigned NOT NULL,
  `user_id` int(11) unsigned NOT NULL,
  `timestamp` datetime NOT NULL,
  PRIMARY KEY (`soundscape_region_tag_id`),
  UNIQUE KEY `soundscape_region_id_2` (`soundscape_region_id`,`recording_id`,`soundscape_tag_id`),
  KEY `user_id` (`user_id`),
  KEY `soundscape_tag_id` (`soundscape_tag_id`),
  KEY `soundscape_region_id` (`soundscape_region_id`),
  KEY `recording_id` (`recording_id`),
  CONSTRAINT `soundscape_region_tags_ibfk_1` FOREIGN KEY (`soundscape_region_id`) REFERENCES `soundscape_regions` (`soundscape_region_id`) ON DELETE CASCADE,
  CONSTRAINT `soundscape_region_tags_ibfk_2` FOREIGN KEY (`recording_id`) REFERENCES `recordings` (`recording_id`) ON DELETE CASCADE,
  CONSTRAINT `soundscape_region_tags_ibfk_3` FOREIGN KEY (`soundscape_tag_id`) REFERENCES `soundscape_tags` (`soundscape_tag_id`),
  CONSTRAINT `soundscape_region_tags_ibfk_4` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `soundscape_regions`
--

DROP TABLE IF EXISTS `soundscape_regions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `soundscape_regions` (
  `soundscape_region_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `soundscape_id` int(11) unsigned NOT NULL,
  `name` varchar(256) NOT NULL,
  `x1` int(11) NOT NULL,
  `y1` int(11) NOT NULL,
  `x2` int(11) NOT NULL,
  `y2` int(11) NOT NULL,
  `count` int(11) unsigned NOT NULL,
  `sample_playlist_id` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`soundscape_region_id`),
  UNIQUE KEY `sample_playlist_id` (`sample_playlist_id`),
  KEY `soundscape_id` (`soundscape_id`),
  CONSTRAINT `soundscape_regions_ibfk_1` FOREIGN KEY (`soundscape_id`) REFERENCES `soundscapes` (`soundscape_id`) ON DELETE CASCADE,
  CONSTRAINT `soundscape_regions_ibfk_2` FOREIGN KEY (`sample_playlist_id`) REFERENCES `playlists` (`playlist_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `soundscape_tags`
--

DROP TABLE IF EXISTS `soundscape_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `soundscape_tags` (
  `soundscape_tag_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `tag` varchar(256) NOT NULL,
  `type` enum('normal','species_sound','','') NOT NULL,
  PRIMARY KEY (`soundscape_tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `soundscapes`
--

DROP TABLE IF EXISTS `soundscapes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `soundscapes` (
  `soundscape_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `soundscape_aggregation_type_id` int(10) unsigned NOT NULL,
  `bin_size` int(11) NOT NULL,
  `uri` text,
  `min_t` int(11) NOT NULL,
  `max_t` int(11) NOT NULL,
  `min_f` int(11) NOT NULL,
  `max_f` int(11) NOT NULL,
  `min_value` int(11) NOT NULL,
  `max_value` int(11) NOT NULL,
  `visual_max_value` int(11) DEFAULT NULL,
  `visual_palette` int(11) NOT NULL DEFAULT '1' COMMENT 'integer representing the color palette for the soundscape',
  `date_created` datetime NOT NULL,
  `playlist_id` int(10) unsigned NOT NULL,
  `frequency` int(11) DEFAULT '0',
  `threshold` float DEFAULT '0',
  PRIMARY KEY (`soundscape_id`),
  KEY `	soundscape_aggregation_type_id` (`soundscape_aggregation_type_id`),
  CONSTRAINT `soundscapes_ibfk_1` FOREIGN KEY (`soundscape_aggregation_type_id`) REFERENCES `soundscape_aggregation_types` (`soundscape_aggregation_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `species`
--

DROP TABLE IF EXISTS `species`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `species` (
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
  KEY `defined_by` (`defined_by`),
  CONSTRAINT `species_ibfk_1` FOREIGN KEY (`taxon_id`) REFERENCES `species_taxons` (`taxon_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `species_ibfk_2` FOREIGN KEY (`family_id`) REFERENCES `species_families` (`family_id`) ON DELETE CASCADE,
  CONSTRAINT `species_ibfk_3` FOREIGN KEY (`defined_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `species_aliases`
--

DROP TABLE IF EXISTS `species_aliases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `species_aliases` (
  `alias_id` int(11) NOT NULL AUTO_INCREMENT,
  `species_id` int(11) NOT NULL,
  `alias` varchar(50) NOT NULL,
  PRIMARY KEY (`alias_id`),
  KEY `species_id` (`species_id`),
  KEY `alias` (`alias`),
  CONSTRAINT `species_aliases_ibfk_1` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `species_families`
--

DROP TABLE IF EXISTS `species_families`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `species_families` (
  `family_id` int(11) NOT NULL AUTO_INCREMENT,
  `family` varchar(300) NOT NULL,
  `taxon_id` int(11) NOT NULL,
  PRIMARY KEY (`family_id`),
  KEY `taxon_id` (`taxon_id`),
  CONSTRAINT `species_families_ibfk_1` FOREIGN KEY (`taxon_id`) REFERENCES `species_taxons` (`taxon_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `species_taxons`
--

DROP TABLE IF EXISTS `species_taxons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `species_taxons` (
  `taxon_id` int(11) NOT NULL AUTO_INCREMENT,
  `taxon` varchar(30) NOT NULL,
  `image` varchar(30) NOT NULL,
  `taxon_order` int(11) NOT NULL,
  `enabled` tinyint(11) NOT NULL,
  PRIMARY KEY (`taxon_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `training_set_roi_set_data`
--

DROP TABLE IF EXISTS `training_set_roi_set_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `training_set_roi_set_data` (
  `roi_set_data_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `training_set_id` bigint(20) unsigned NOT NULL,
  `recording_id` bigint(20) unsigned NOT NULL,
  `species_id` int(11) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  `x1` double NOT NULL COMMENT 'initial time in seconds',
  `y1` double NOT NULL COMMENT 'min frequency in hertz',
  `x2` double NOT NULL COMMENT 'final time in seconds',
  `y2` double NOT NULL COMMENT 'max frequency in hertz',
  `uri` text,
  PRIMARY KEY (`roi_set_data_id`),
  KEY `recording_id` (`recording_id`),
  KEY `training_set_id` (`training_set_id`),
  KEY `species_id` (`species_id`),
  KEY `songtype_id` (`songtype_id`),
  CONSTRAINT `training_set_roi_set_data_ibfk_1` FOREIGN KEY (`training_set_id`) REFERENCES `training_sets` (`training_set_id`) ON DELETE CASCADE,
  CONSTRAINT `training_set_roi_set_data_ibfk_2` FOREIGN KEY (`recording_id`) REFERENCES `recordings` (`recording_id`),
  CONSTRAINT `training_set_roi_set_data_ibfk_3` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`),
  CONSTRAINT `training_set_roi_set_data_ibfk_4` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `training_set_types`
--

DROP TABLE IF EXISTS `training_set_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `training_set_types` (
  `training_set_type_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `identifier` varchar(255) NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`training_set_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `training_sets`
--

DROP TABLE IF EXISTS `training_sets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `training_sets` (
  `training_set_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `date_created` date NOT NULL,
  `training_set_type_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`training_set_id`),
  UNIQUE KEY `project_id_2` (`project_id`,`name`),
  KEY `project_id` (`project_id`),
  KEY `training_set_type_id` (`training_set_type_id`),
  CONSTRAINT `training_sets_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  CONSTRAINT `training_sets_ibfk_2` FOREIGN KEY (`training_set_type_id`) REFERENCES `training_set_types` (`training_set_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `training_sets_roi_set`
--

DROP TABLE IF EXISTS `training_sets_roi_set`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `training_sets_roi_set` (
  `training_set_id` bigint(20) unsigned NOT NULL,
  `species_id` int(11) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  PRIMARY KEY (`training_set_id`),
  KEY `species_id` (`species_id`),
  KEY `songtype_id` (`songtype_id`),
  CONSTRAINT `training_sets_roi_set_ibfk_1` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`),
  CONSTRAINT `training_sets_roi_set_ibfk_2` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`),
  CONSTRAINT `training_sets_roi_set_ibfk_3` FOREIGN KEY (`training_set_id`) REFERENCES `training_sets` (`training_set_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `uploads_processing`
--

DROP TABLE IF EXISTS `uploads_processing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `uploads_processing` (
  `upload_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `site_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `upload_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `filename` varchar(100) NOT NULL,
  PRIMARY KEY (`upload_id`),
  UNIQUE KEY `filename` (`filename`),
  KEY `project_id` (`project_id`),
  KEY `site_id` (`site_id`),
  KEY `user_id` (`user_id`),
  KEY `upload_time` (`upload_time`),
  CONSTRAINT `uploads_processing_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `uploads_processing_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `sites` (`site_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `uploads_processing_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='recording uploaded and being process';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_account_support_request`
--

DROP TABLE IF EXISTS `user_account_support_request`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_account_support_request` (
  `support_request_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned DEFAULT NULL,
  `support_type_id` int(10) unsigned NOT NULL,
  `hash` varchar(64) NOT NULL,
  `params` text NOT NULL,
  `consumed` tinyint(1) NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `expires` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`support_request_id`),
  KEY `user_id` (`user_id`),
  KEY `support_type_id` (`support_type_id`),
  CONSTRAINT `user_account_support_request_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `user_account_support_request_ibfk_2` FOREIGN KEY (`support_type_id`) REFERENCES `user_account_support_type` (`account_support_type_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_account_support_type`
--

DROP TABLE IF EXISTS `user_account_support_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_account_support_type` (
  `account_support_type_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `max_lifetime` int(11) DEFAULT NULL COMMENT 'maximum lifetime in seconds of this support type',
  PRIMARY KEY (`account_support_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_project_role`
--

DROP TABLE IF EXISTS `user_project_role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_project_role` (
  `user_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `role_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`user_id`,`project_id`),
  KEY `project_id` (`project_id`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `user_project_role_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `user_project_role_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  CONSTRAINT `user_project_role_ibfk_3` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `user_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `login` varchar(32) NOT NULL,
  `password` varchar(64) NOT NULL,
  `firstname` varchar(255) NOT NULL,
  `lastname` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `last_login` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `is_super` tinyint(1) NOT NULL DEFAULT '0',
  `project_limit` int(10) unsigned NOT NULL DEFAULT '1',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `login` (`login`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `validation_set`
--

DROP TABLE IF EXISTS `validation_set`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `validation_set` (
  `validation_set_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `uri` varchar(255) NOT NULL,
  `params` text NOT NULL,
  `job_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`validation_set_id`),
  KEY `job_id` (`job_id`),
  CONSTRAINT `validation_set_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2015-01-26 14:54:05
