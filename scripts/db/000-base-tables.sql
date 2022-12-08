-- MySQL dump 10.13  Distrib 8.0.22, for osx10.15 (x86_64)
--
-- Host: 127.0.0.1    Database: arbimon2
-- ------------------------------------------------------
-- Server version	5.6.10

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `activation_codes`
--

DROP TABLE IF EXISTS `activation_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activation_codes` (
  `activation_code_id` int(11) NOT NULL AUTO_INCREMENT,
  `hash` varchar(255) NOT NULL,
  `created` datetime NOT NULL,
  `creator` int(11) NOT NULL,
  `payload` text NOT NULL,
  `consumed` tinyint(1) NOT NULL,
  `consumer` int(11) DEFAULT NULL,
  `project` int(11) DEFAULT NULL,
  PRIMARY KEY (`activation_code_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `addresses`
--

DROP TABLE IF EXISTS `addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `addresses` (
  `user_id` int(10) unsigned NOT NULL,
  `name` varchar(45) NOT NULL,
  `line1` varchar(50) NOT NULL,
  `line2` varchar(50) NOT NULL,
  `city` varchar(20) NOT NULL,
  `state` varchar(10) NOT NULL,
  `country_code` varchar(2) NOT NULL,
  `postal_code` varchar(20) NOT NULL,
  `telephone` varchar(20) NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_addresses_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audio_event_detection_algorithm_configurations`
--

DROP TABLE IF EXISTS `audio_event_detection_algorithm_configurations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audio_event_detection_algorithm_configurations` (
  `aedc_id` int(11) NOT NULL AUTO_INCREMENT,
  `algorithm_id` int(11) NOT NULL,
  `parameters` text NOT NULL,
  `hash` varchar(255) NOT NULL,
  PRIMARY KEY (`aedc_id`),
  UNIQUE KEY `hash` (`hash`),
  KEY `algorithm_id` (`algorithm_id`),
  CONSTRAINT `audio_event_detection_algorithm_configurations_ibfk_1` FOREIGN KEY (`algorithm_id`) REFERENCES `audio_event_detection_algorithms` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audio_event_detection_algorithms`
--

DROP TABLE IF EXISTS `audio_event_detection_algorithms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audio_event_detection_algorithms` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL,
  `description` text NOT NULL,
  `defaults` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audio_event_detection_statistics`
--

DROP TABLE IF EXISTS `audio_event_detection_statistics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audio_event_detection_statistics` (
  `id` varchar(255) NOT NULL,
  `name` text NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audio_event_detections`
--

DROP TABLE IF EXISTS `audio_event_detections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audio_event_detections` (
  `aed_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `configuration_id` int(11) NOT NULL,
  `project_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `playlist_id` int(11) NOT NULL,
  `statistics` text NOT NULL,
  `date_created` datetime NOT NULL,
  `plot_params` text,
  PRIMARY KEY (`aed_id`)
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `classification_results`
--

DROP TABLE IF EXISTS `classification_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `classification_results` (
  `classification_result_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `job_id` int(11) NOT NULL,
  `recording_id` int(11) NOT NULL,
  `species_id` int(11) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  `present` tinyint(4) NOT NULL,
  `max_vector_value` float DEFAULT NULL,
  `min_vector_value` float DEFAULT NULL,
  PRIMARY KEY (`classification_result_id`),
  UNIQUE KEY `job_id_2` (`job_id`,`recording_id`),
  KEY `job_id` (`job_id`),
  KEY `recording_id` (`recording_id`),
  KEY `species_id` (`species_id`),
  KEY `songtype_id` (`songtype_id`),
  KEY `job_rec` (`job_id`,`recording_id`),
  CONSTRAINT `classification_results_ibfk_1` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`),
  CONSTRAINT `classification_results_ibfk_2` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`)
) ENGINE=InnoDB AUTO_INCREMENT=33245584 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `classification_stats`
--

DROP TABLE IF EXISTS `classification_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `classification_stats` (
  `job_id` int(11) NOT NULL,
  `json_stats` text CHARACTER SET latin1 NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cnn_model_species`
--

DROP TABLE IF EXISTS `cnn_model_species`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cnn_model_species` (
  `cnn_id` int(11) unsigned NOT NULL,
  `species_id` int(11) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  PRIMARY KEY (`cnn_id`,`species_id`,`songtype_id`),
  KEY `cnn_model_species_ibfk_2_idx` (`species_id`),
  KEY `cnn_model_species_ibfk_3_idx` (`songtype_id`),
  CONSTRAINT `cnn_model_species_ibfk_1` FOREIGN KEY (`cnn_id`) REFERENCES `cnn_models` (`cnn_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `cnn_model_species_ibfk_2` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `cnn_model_species_ibfk_3` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cnn_models`
--

DROP TABLE IF EXISTS `cnn_models`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cnn_models` (
  `cnn_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(45) DEFAULT NULL,
  `uri` varchar(45) DEFAULT NULL,
  `stats` varchar(45) DEFAULT NULL,
  `sample_rate` mediumint(8) unsigned NOT NULL,
  `info` text NOT NULL,
  `arn` text NOT NULL,
  PRIMARY KEY (`cnn_id`),
  UNIQUE KEY `cnn_id_UNIQUE` (`cnn_id`),
  UNIQUE KEY `uri_UNIQUE` (`uri`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cnn_results_presence`
--

DROP TABLE IF EXISTS `cnn_results_presence`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cnn_results_presence` (
  `cnn_presence_id` int(11) NOT NULL AUTO_INCREMENT,
  `job_id` bigint(20) unsigned NOT NULL,
  `recording_id` bigint(20) unsigned NOT NULL,
  `species_id` int(11) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  `present` tinyint(4) unsigned NOT NULL,
  `max_score` float NOT NULL,
  `cnn_result_roi_id` int(11) NOT NULL DEFAULT '-1',
  PRIMARY KEY (`cnn_presence_id`),
  KEY `cnn_results_pres_ibfk_1_idx` (`recording_id`),
  KEY `cnn_results_presence_ibfk_2_idx` (`cnn_result_roi_id`),
  CONSTRAINT `cnn_results_presence_ibfk_1` FOREIGN KEY (`recording_id`) REFERENCES `recordings` (`recording_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=51117 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cnn_results_rois`
--

DROP TABLE IF EXISTS `cnn_results_rois`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cnn_results_rois` (
  `cnn_result_roi_id` int(11) NOT NULL AUTO_INCREMENT,
  `job_id` bigint(20) unsigned NOT NULL,
  `recording_id` bigint(20) unsigned NOT NULL,
  `species_id` int(11) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  `x1` float NOT NULL,
  `y1` float NOT NULL,
  `x2` float NOT NULL,
  `y2` float NOT NULL,
  `uri` text NOT NULL,
  `score` float NOT NULL,
  `validated` tinyint(4) DEFAULT NULL,
  PRIMARY KEY (`cnn_result_roi_id`),
  KEY `fk_cnn_results_rois_2_idx` (`recording_id`),
  KEY `fk_cnn_results_rois_3_idx` (`species_id`),
  KEY `fk_cnn_results_rois_4_idx` (`songtype_id`),
  CONSTRAINT `fk_cnn_results_rois_2` FOREIGN KEY (`recording_id`) REFERENCES `recordings` (`recording_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_cnn_results_rois_3` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_cnn_results_rois_4` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=1577126 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cnn_templates`
--

DROP TABLE IF EXISTS `cnn_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cnn_templates` (
  `cnn_id` int(10) unsigned NOT NULL,
  `template_id` int(11) NOT NULL,
  PRIMARY KEY (`cnn_id`,`template_id`),
  KEY `cnn_templates_ibfk_2_idx` (`template_id`),
  CONSTRAINT `cnn_templates_ibfk_1` FOREIGN KEY (`cnn_id`) REFERENCES `cnn_models` (`cnn_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `cnn_templates_ibfk_2` FOREIGN KEY (`template_id`) REFERENCES `templates` (`template_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invalid_logins`
--

DROP TABLE IF EXISTS `invalid_logins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invalid_logins` (
  `ip` varchar(40) NOT NULL,
  `time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user` varchar(32) NOT NULL,
  `reason` varchar(50) NOT NULL,
  PRIMARY KEY (`ip`,`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_execution_task_steps`
--

DROP TABLE IF EXISTS `job_execution_task_steps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_execution_task_steps` (
  `job_task_id` int(11) NOT NULL,
  `index` int(11) NOT NULL,
  `status` enum('waiting','processing','completed','error') NOT NULL,
  `remark` text,
  PRIMARY KEY (`job_task_id`,`index`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_execution_task_types`
--

DROP TABLE IF EXISTS `job_execution_task_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_execution_task_types` (
  `step_type_id` smallint(6) NOT NULL AUTO_INCREMENT,
  `job_type_id` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `typedef` text NOT NULL,
  PRIMARY KEY (`step_type_id`),
  KEY `job_type_id` (`job_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_execution_tasks`
--

DROP TABLE IF EXISTS `job_execution_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_execution_tasks` (
  `job_id` int(11) NOT NULL,
  `idx` int(11) NOT NULL,
  `task_type_id` int(11) NOT NULL,
  `completed` tinyint(4) NOT NULL,
  PRIMARY KEY (`job_id`,`idx`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_params_audio_event_detection`
--

DROP TABLE IF EXISTS `job_params_audio_event_detection`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_params_audio_event_detection` (
  `job_id` bigint(20) unsigned NOT NULL,
  `name` text NOT NULL,
  `playlist_id` int(10) unsigned NOT NULL,
  `configuration_id` int(11) NOT NULL,
  `statistics` text NOT NULL,
  PRIMARY KEY (`job_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_params_classification`
--

DROP TABLE IF EXISTS `job_params_classification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
-- Table structure for table `job_params_cnn`
--

DROP TABLE IF EXISTS `job_params_cnn`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_params_cnn` (
  `job_id` bigint(20) unsigned NOT NULL,
  `cnn_id` int(10) unsigned NOT NULL,
  `playlist_id` int(10) unsigned DEFAULT NULL,
  `name` text NOT NULL,
  `timestamp` timestamp NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `deleted` tinyint(1) NOT NULL,
  PRIMARY KEY (`job_id`),
  KEY `_idx` (`cnn_id`),
  KEY `job_params_cnn_ibfk_2_idx` (`playlist_id`),
  CONSTRAINT `job_params_cnn_ibfk_1` FOREIGN KEY (`cnn_id`) REFERENCES `cnn_models` (`cnn_id`),
  CONSTRAINT `job_params_cnn_ibfk_2` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`playlist_id`) ON DELETE SET NULL,
  CONSTRAINT `job_params_cnn_ibfk_3` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_params_pattern_matching`
--

DROP TABLE IF EXISTS `job_params_pattern_matching`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_params_pattern_matching` (
  `job_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `playlist_id` int(10) unsigned NOT NULL,
  `template_id` int(11) NOT NULL,
  `params` text NOT NULL,
  PRIMARY KEY (`job_id`),
  KEY `fk_job_params_pattern_matching_2_idx` (`playlist_id`),
  KEY `fk_job_params_pattern_matching_3_idx` (`template_id`),
  CONSTRAINT `fk_job_params_pattern_matching_1` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_job_params_pattern_matching_2` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`playlist_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_job_params_pattern_matching_3` FOREIGN KEY (`template_id`) REFERENCES `templates` (`template_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_params_soundscape`
--

DROP TABLE IF EXISTS `job_params_soundscape`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_params_soundscape` (
  `job_id` bigint(11) unsigned NOT NULL,
  `playlist_id` int(10) unsigned DEFAULT NULL,
  `max_hertz` int(11) NOT NULL,
  `bin_size` int(11) NOT NULL,
  `soundscape_aggregation_type_id` int(10) unsigned NOT NULL,
  `name` text NOT NULL,
  `threshold` float NOT NULL DEFAULT '0',
  `threshold_type` enum('absolute','relative-to-peak-maximum') NOT NULL DEFAULT 'absolute',
  `frequency` int(11) NOT NULL DEFAULT '0',
  `normalize` tinyint(1) NOT NULL DEFAULT '0',
  UNIQUE KEY `job_id` (`job_id`),
  KEY `playlist_id` (`playlist_id`),
  KEY `soundscape_aggregation_type_id` (`soundscape_aggregation_type_id`),
  CONSTRAINT `job_params_soundscape_ibfk_1` FOREIGN KEY (`soundscape_aggregation_type_id`) REFERENCES `soundscape_aggregation_types` (`soundscape_aggregation_type_id`),
  CONSTRAINT `job_params_soundscape_ibfk_2` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_params_training`
--

DROP TABLE IF EXISTS `job_params_training`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_params_training` (
  `job_id` bigint(20) unsigned NOT NULL,
  `model_type_id` int(10) unsigned NOT NULL,
  `training_set_id` bigint(20) unsigned DEFAULT NULL,
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
  CONSTRAINT `job_params_training_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`) ON DELETE CASCADE,
  CONSTRAINT `job_params_training_ibfk_2` FOREIGN KEY (`model_type_id`) REFERENCES `model_types` (`model_type_id`),
  CONSTRAINT `job_params_training_ibfk_3` FOREIGN KEY (`training_set_id`) REFERENCES `training_sets` (`training_set_id`) ON DELETE SET NULL,
  CONSTRAINT `job_params_training_ibfk_4` FOREIGN KEY (`validation_set_id`) REFERENCES `validation_set` (`validation_set_id`),
  CONSTRAINT `job_params_training_ibfk_5` FOREIGN KEY (`trained_model_id`) REFERENCES `models` (`model_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_queue_enqueued_jobs`
--

DROP TABLE IF EXISTS `job_queue_enqueued_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=27890 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_queues`
--

DROP TABLE IF EXISTS `job_queues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `run_types` set('script','task') NOT NULL DEFAULT 'script' COMMENT 'Run type of jobs handled by this job queue ',
  PRIMARY KEY (`job_queue_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2564 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Temporary view structure for view `job_stats_by_month`
--

DROP TABLE IF EXISTS `job_stats_by_month`;
/*!50001 DROP VIEW IF EXISTS `job_stats_by_month`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `job_stats_by_month` AS SELECT
 1 AS `month_date`,
 1 AS `jobs`,
 1 AS `job_type_id`,
 1 AS `state`,
 1 AS `job_steps`,
 1 AS `job_hours`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `job_task_dependencies`
--

DROP TABLE IF EXISTS `job_task_dependencies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_task_dependencies` (
  `task_id` bigint(20) unsigned NOT NULL,
  `dependency_id` bigint(20) unsigned NOT NULL,
  `satisfied` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`task_id`,`dependency_id`),
  KEY `task_satisfied` (`task_id`,`satisfied`),
  KEY `dependency_id_idx` (`dependency_id`),
  CONSTRAINT `dependency_id` FOREIGN KEY (`dependency_id`) REFERENCES `job_tasks` (`task_id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `task_id` FOREIGN KEY (`task_id`) REFERENCES `job_tasks` (`task_id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_task_types`
--

DROP TABLE IF EXISTS `job_task_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_task_types` (
  `type_id` int(11) NOT NULL AUTO_INCREMENT,
  `identifier` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `typedef` text NOT NULL,
  PRIMARY KEY (`type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_tasks`
--

DROP TABLE IF EXISTS `job_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_tasks` (
  `task_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `job_id` bigint(20) unsigned NOT NULL,
  `step` int(11) NOT NULL,
  `type_id` int(11) NOT NULL,
  `dependency_counter` int(11) NOT NULL DEFAULT '0',
  `status` enum('waiting','assigned','processing','completed','error','stalled') NOT NULL,
  `remark` text,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `args` text,
  PRIMARY KEY (`task_id`),
  KEY `job_id_idx` (`job_id`),
  KEY `status_dependecies` (`status`,`dependency_counter`),
  KEY `job_step_status` (`job_id`,`step`,`status`),
  CONSTRAINT `job_id` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=48 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_types`
--

DROP TABLE IF EXISTS `job_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_types` (
  `job_type_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `identifier` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `enabled` int(11) NOT NULL,
  `script` varchar(255) NOT NULL,
  `run_type` enum('script','task','manual','') NOT NULL DEFAULT 'script' COMMENT 'Manner in which the job is executed:\\n- script - the job is executed buy running a script (path is in script, relative to job queue’s script path)\\n- task - the job is executed by issuing a task into the job tasks system (task is in script, arguments are the job’s id)\\n- manual - the job is run manually',
  PRIMARY KEY (`job_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `ncpu` int(11) NOT NULL DEFAULT '3',
  PRIMARY KEY (`job_id`),
  KEY `user_id` (`user_id`),
  KEY `project_id` (`project_id`),
  KEY `job_type_id` (`job_type_id`),
  CONSTRAINT `jobs_ibfk_1` FOREIGN KEY (`job_type_id`) REFERENCES `job_types` (`job_type_id`),
  CONSTRAINT `jobs_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  CONSTRAINT `jobs_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=19576 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = '' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`admin`@`%`*/ /*!50003 TRIGGER `arbimon2`.`jobs_BEFORE_UPDATE` BEFORE UPDATE ON `jobs` FOR EACH ROW
BEGIN
   IF (NEW.progress >= OLD.progress_steps)
   THEN
	   SET NEW.state = "completed";

	   IF (NEW.job_type_id = 6)
       THEN
            SELECT pattern_matching_id
	        INTO @pattern_matching_id
            FROM `arbimon2`.`pattern_matchings`
            WHERE job_id = NEW.job_id;
            CALL pattern_matching_postprocess(@pattern_matching_id);
       END IF;

   END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `model_classes`
--

DROP TABLE IF EXISTS `model_classes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_classes` (
  `model_id` int(10) unsigned NOT NULL,
  `species_id` int(10) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  PRIMARY KEY (`model_id`,`species_id`,`songtype_id`),
  KEY `species_id` (`species_id`),
  KEY `songtype_id` (`songtype_id`),
  CONSTRAINT `model_classes_ibfk_1` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`),
  CONSTRAINT `model_classes_ibfk_2` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`),
  CONSTRAINT `model_classes_ibfk_3` FOREIGN KEY (`model_id`) REFERENCES `models` (`model_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `model_stats`
--

DROP TABLE IF EXISTS `model_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_stats` (
  `model_id` int(10) unsigned NOT NULL,
  `json_stats` text NOT NULL,
  UNIQUE KEY `model_id` (`model_id`),
  CONSTRAINT `model_stats_ibfk_1` FOREIGN KEY (`model_id`) REFERENCES `models` (`model_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `model_types`
--

DROP TABLE IF EXISTS `model_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_types` (
  `model_type_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `training_set_type_id` int(10) unsigned NOT NULL,
  `usesSsim` tinyint(4) NOT NULL DEFAULT '0',
  `usesRansac` tinyint(1) NOT NULL DEFAULT '0',
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`model_type_id`),
  KEY `training_set_type` (`training_set_type_id`),
  CONSTRAINT `model_types_ibfk_1` FOREIGN KEY (`training_set_type_id`) REFERENCES `training_set_types` (`training_set_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `models`
--

DROP TABLE IF EXISTS `models`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=3772 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `order_id` varchar(36) NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `datetime` datetime NOT NULL,
  `status` varchar(20) NOT NULL COMMENT 'created,\napproved,\ncanceled',
  `action` varchar(45) NOT NULL,
  `data` text NOT NULL COMMENT 'order data in JSON format',
  `paypal_payment_id` varchar(50) NOT NULL COMMENT 'JSON object',
  `payment_data` text,
  `error` text,
  PRIMARY KEY (`order_id`),
  KEY `fk_orders_2_idx` (`user_id`),
  CONSTRAINT `fk_orders_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pattern_matching_rois`
--

DROP TABLE IF EXISTS `pattern_matching_rois`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `score` double DEFAULT NULL,
  `validated` tinyint(1) DEFAULT NULL,
  `cs_val_present` int(11) NOT NULL DEFAULT '0' COMMENT 'current count of cs present votes',
  `cs_val_not_present` int(11) NOT NULL DEFAULT '0' COMMENT 'current count of cs not present votes',
  `consensus_validated` tinyint(1) DEFAULT NULL,
  `expert_validated` tinyint(1) DEFAULT NULL,
  `expert_validation_user_id` int(11) DEFAULT NULL,
  `denorm_site_id` int(10) unsigned DEFAULT NULL,
  `denorm_recording_datetime` datetime DEFAULT NULL,
  `denorm_recording_date` date DEFAULT NULL,
  PRIMARY KEY (`pattern_matching_roi_id`),
  KEY `fk_pattern_matching_matches_1_idx` (`pattern_matching_id`),
  KEY `fk_pattern_matching_matches_2_idx` (`recording_id`),
  KEY `fk_pattern_matching_matches_3_idx` (`species_id`),
  KEY `fk_pattern_matching_matches_4_idx` (`songtype_id`),
  KEY `pattern_matching_matches_recording_score_idx` (`recording_id`,`score`),
  KEY `pattern_matching_matches_site_score_idx` (`pattern_matching_id`,`denorm_site_id`,`score`),
  KEY `pattern_matching_matches_site_datetime_score_idx` (`pattern_matching_id`,`denorm_site_id`,`denorm_recording_date`,`score`),
  KEY `fk_pattern_matching_rois_1_idx` (`denorm_site_id`),
  KEY `validated_idx` (`validated`),
  CONSTRAINT `fk_pattern_matching_matches_1` FOREIGN KEY (`pattern_matching_id`) REFERENCES `pattern_matchings` (`pattern_matching_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pattern_matching_matches_2` FOREIGN KEY (`recording_id`) REFERENCES `recordings` (`recording_id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_pattern_matching_matches_3` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pattern_matching_matches_4` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pattern_matching_rois_1` FOREIGN KEY (`denorm_site_id`) REFERENCES `sites` (`site_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=85026209 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pattern_matching_user_statistics`
--

DROP TABLE IF EXISTS `pattern_matching_user_statistics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pattern_matching_user_statistics` (
  `user_statistics_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `species_id` int(11) NOT NULL,
  `songtype_id` int(11) NOT NULL,
  `validated` int(11) NOT NULL,
  `correct` int(11) NOT NULL,
  `incorrect` int(11) NOT NULL,
  `pending` int(11) NOT NULL DEFAULT '0',
  `confidence` float NOT NULL,
  `last_update` timestamp NOT NULL,
  PRIMARY KEY (`user_statistics_id`),
  UNIQUE KEY `uk_pattern_matching_user_statistics_1` (`user_id`,`project_id`,`species_id`,`songtype_id`),
  KEY `fk_pattern_matching_user_statistics_2` (`project_id`),
  KEY `fk_pattern_matching_user_statistics_3` (`species_id`),
  KEY `fk_pattern_matching_user_statistics_4` (`songtype_id`),
  CONSTRAINT `fk_pattern_matching_user_statistics_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pattern_matching_user_statistics_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pattern_matching_user_statistics_3` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pattern_matching_user_statistics_4` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=34143 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pattern_matching_validations`
--

DROP TABLE IF EXISTS `pattern_matching_validations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pattern_matching_validations` (
  `validation_id` int(11) NOT NULL AUTO_INCREMENT,
  `pattern_matching_roi_id` int(11) NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `timestamp` timestamp NOT NULL,
  `validated` int(11) NOT NULL,
  PRIMARY KEY (`validation_id`),
  KEY `fk_pattern_matching_validations_1` (`pattern_matching_roi_id`),
  KEY `fk_pattern_matching_validations_2` (`user_id`),
  CONSTRAINT `fk_pattern_matching_validations_1` FOREIGN KEY (`pattern_matching_roi_id`) REFERENCES `pattern_matching_rois` (`pattern_matching_roi_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pattern_matching_validations_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=686780 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pattern_matchings`
--

DROP TABLE IF EXISTS `pattern_matchings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `completed` tinyint(1) NOT NULL DEFAULT '0',
  `deleted` tinyint(1) NOT NULL DEFAULT '0',
  `job_id` bigint(20) unsigned DEFAULT NULL,
  `citizen_scientist` tinyint(1) NOT NULL DEFAULT '0',
  `consensus_number` int(11) NOT NULL DEFAULT '3',
  `cs_expert` tinyint(1) NOT NULL,
  PRIMARY KEY (`pattern_matching_id`),
  KEY `fk_pattern_matchings_1_idx` (`species_id`),
  KEY `fk_pattern_matchings_2_idx` (`songtype_id`),
  KEY `fk_pattern_matchings_3_idx` (`playlist_id`),
  KEY `fk_pattern_matchings_5_idx` (`project_id`),
  KEY `fk_pattern_matchings_job_id_idx` (`job_id`),
  CONSTRAINT `fk_pattern_matchings_1` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pattern_matchings_2` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pattern_matchings_3` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`playlist_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pattern_matchings_5` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=5020 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `permission_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `security_level` int(10) unsigned NOT NULL,
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `plan_credits_use`
--

DROP TABLE IF EXISTS `plan_credits_use`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plan_credits_use` (
  `plan_credits_use_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `job_id` bigint(20) unsigned DEFAULT NULL,
  `job_type_id` int(10) unsigned DEFAULT NULL,
  `playlist_id` int(10) unsigned DEFAULT NULL,
  `credits` int(11) NOT NULL,
  PRIMARY KEY (`plan_credits_use_id`),
  KEY `fk_plan_use_project_id_idx` (`project_id`),
  KEY `fk_plan_use_job_id_idx` (`job_id`),
  KEY `fk_plan_use_job_type_id_idx` (`job_type_id`),
  KEY `fk_plan_use_playlist_id_idx` (`playlist_id`),
  CONSTRAINT `fk_plan_use_job_id` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_plan_use_job_type_id` FOREIGN KEY (`job_type_id`) REFERENCES `job_types` (`job_type_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_plan_use_playlist_id` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`playlist_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_plan_use_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `playlist_recordings`
--

DROP TABLE IF EXISTS `playlist_recordings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `playlist_types` (
  `playlist_type_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`playlist_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `playlists`
--

DROP TABLE IF EXISTS `playlists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `playlists` (
  `playlist_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `playlist_type_id` int(10) unsigned NOT NULL,
  `uri` varchar(255) DEFAULT NULL,
  `metadata` text,
  PRIMARY KEY (`playlist_id`),
  UNIQUE KEY `project_id_2` (`project_id`,`name`),
  KEY `project_id` (`project_id`),
  KEY `playlist_type_id` (`playlist_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10714 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_classes`
--

DROP TABLE IF EXISTS `project_classes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=6500 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_imported_models`
--

DROP TABLE IF EXISTS `project_imported_models`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_imported_models` (
  `model_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`model_id`,`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_imported_sites`
--

DROP TABLE IF EXISTS `project_imported_sites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_imported_sites` (
  `site_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`site_id`,`project_id`),
  KEY `fk_project_published_site_2_idx` (`project_id`),
  CONSTRAINT `fk_project_published_site_1` FOREIGN KEY (`site_id`) REFERENCES `sites` (`site_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_project_published_site_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='published sites added to projects (DEPRECATED))';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_news`
--

DROP TABLE IF EXISTS `project_news`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=33431 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_news_types`
--

DROP TABLE IF EXISTS `project_news_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_news_types` (
  `news_type_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(30) NOT NULL,
  `description` text NOT NULL,
  `message_format` text NOT NULL,
  PRIMARY KEY (`news_type_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Temporary view structure for view `project_plan_owner`
--

DROP TABLE IF EXISTS `project_plan_owner`;
/*!50001 DROP VIEW IF EXISTS `project_plan_owner`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `project_plan_owner` AS SELECT
 1 AS `name`,
 1 AS `firstname`,
 1 AS `lastname`,
 1 AS `email`,
 1 AS `plan_date`,
 1 AS `tier`,
 1 AS `storage`,
 1 AS `processing`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `project_plans`
--

DROP TABLE IF EXISTS `project_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_plans` (
  `plan_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `created_on` date DEFAULT NULL,
  `activation` date DEFAULT NULL COMMENT 'project activation date - this is when the first upload was done or after 30 days of the project creation',
  `storage` int(10) unsigned NOT NULL COMMENT 'storage capacity',
  `processing` int(10) unsigned NOT NULL COMMENT 'processing capacity',
  `duration_period` int(10) unsigned DEFAULT NULL COMMENT 'plan duration in years',
  `tier` varchar(10) DEFAULT NULL,
  `credits_purchased` int(10) unsigned NOT NULL DEFAULT '0',
  `credits_used` int(10) unsigned NOT NULL DEFAULT '0',
  `recs_purchased` int(10) unsigned NOT NULL DEFAULT '0',
  `recs_used` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`plan_id`),
  KEY `fk_plans_1_idx` (`project_id`),
  KEY `index3` (`activation`),
  CONSTRAINT `fk_plans_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=676 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_soundscape_composition_classes`
--

DROP TABLE IF EXISTS `project_soundscape_composition_classes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_soundscape_composition_classes` (
  `projectId` int(10) unsigned NOT NULL,
  `scclassId` int(11) NOT NULL,
  `order` int(11) NOT NULL,
  PRIMARY KEY (`projectId`,`scclassId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_types`
--

DROP TABLE IF EXISTS `project_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_types` (
  `project_type_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`project_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `project_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `url` varchar(255) NOT NULL,
  `description` text,
  `project_type_id` int(10) unsigned NOT NULL,
  `is_private` tinyint(1) NOT NULL,
  `is_enabled` tinyint(4) NOT NULL DEFAULT '1',
  `current_plan` int(10) unsigned DEFAULT NULL,
  `storage_usage` float DEFAULT NULL,
  `processing_usage` float DEFAULT NULL,
  `pattern_matching_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `citizen_scientist_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `cnn_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `reports_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `external_id` varchar(12) DEFAULT NULL,
  PRIMARY KEY (`project_id`),
  UNIQUE KEY `url` (`url`),
  KEY `project_type_id` (`project_type_id`),
  KEY `current_plan` (`current_plan`),
  CONSTRAINT `projects_ibfk_2` FOREIGN KEY (`project_type_id`) REFERENCES `project_types` (`project_type_id`),
  CONSTRAINT `projects_ibfk_3` FOREIGN KEY (`current_plan`) REFERENCES `project_plans` (`plan_id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=1560 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `recanalizer_stats`
--

DROP TABLE IF EXISTS `recanalizer_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recanalizer_stats` (
  `job_id` int(11) NOT NULL,
  `rec_id` int(11) NOT NULL,
  `exec_time` float NOT NULL,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=856861 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `recording_soundscape_composition_annotations`
--

DROP TABLE IF EXISTS `recording_soundscape_composition_annotations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recording_soundscape_composition_annotations` (
  `recordingId` bigint(20) unsigned NOT NULL,
  `scclassId` int(11) NOT NULL,
  `present` tinyint(1) NOT NULL,
  PRIMARY KEY (`recordingId`,`scclassId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `recording_tags`
--

DROP TABLE IF EXISTS `recording_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recording_tags` (
  `recording_tag_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `recording_id` bigint(20) unsigned NOT NULL,
  `tag_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `datetime` datetime NOT NULL,
  `t0` float DEFAULT NULL,
  `f0` float DEFAULT NULL,
  `t1` float DEFAULT NULL,
  `f1` float DEFAULT NULL,
  PRIMARY KEY (`recording_tag_id`),
  UNIQUE KEY `recording_id` (`recording_id`,`tag_id`,`user_id`),
  KEY `tag_id` (`tag_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `recording_tags_ibfk_1` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`tag_id`),
  CONSTRAINT `recording_tags_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=81042 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `recording_validations`
--

DROP TABLE IF EXISTS `recording_validations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  CONSTRAINT `recording_validations_ibfk_2` FOREIGN KEY (`recording_id`) REFERENCES `recordings` (`recording_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `recording_validations_ibfk_5` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `recording_validations_ibfk_6` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`),
  CONSTRAINT `recording_validations_ibfk_7` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`),
  CONSTRAINT `recording_validations_ibfk_8` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3001387 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `recordings`
--

DROP TABLE IF EXISTS `recordings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recordings` (
  `recording_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `site_id` int(10) unsigned NOT NULL,
  `uri` varchar(255) NOT NULL,
  `datetime` datetime NOT NULL,
  `mic` varchar(255) NOT NULL,
  `recorder` varchar(255) NOT NULL,
  `version` varchar(255) NOT NULL,
  `sample_rate` mediumint(8) unsigned DEFAULT NULL,
  `precision` tinyint(3) unsigned DEFAULT NULL,
  `duration` float DEFAULT NULL,
  `samples` bigint(20) unsigned DEFAULT NULL,
  `file_size` bigint(45) DEFAULT NULL,
  `bit_rate` varchar(45) DEFAULT NULL,
  `sample_encoding` varchar(45) DEFAULT NULL,
  `upload_time` datetime DEFAULT NULL,
  PRIMARY KEY (`recording_id`),
  UNIQUE KEY `unique_uri` (`uri`),
  KEY `site_id` (`site_id`),
  KEY `recs_by_upload_time` (`upload_time`,`site_id`),
  KEY `datetime_idx` (`datetime`),
  CONSTRAINT `recordings_ibfk_1` FOREIGN KEY (`site_id`) REFERENCES `sites` (`site_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7981390 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `recordings_errors`
--

DROP TABLE IF EXISTS `recordings_errors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recordings_errors` (
  `recording_id` int(11) NOT NULL,
  `job_id` int(11) NOT NULL,
  `error` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `role_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `icon` varchar(64) NOT NULL,
  `level` int(11) NOT NULL,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `session_id` varchar(255) COLLATE utf8_bin NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` text COLLATE utf8_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_connection_log`
--

DROP TABLE IF EXISTS `site_connection_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_connection_log` (
  `log_entry_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `site_id` int(11) unsigned NOT NULL,
  `datetime` datetime NOT NULL,
  `connection` tinyint(4) DEFAULT NULL,
  PRIMARY KEY (`log_entry_id`),
  KEY `site_id` (`site_id`),
  KEY `connection` (`connection`),
  CONSTRAINT `site_connection_log_ibfk_1` FOREIGN KEY (`connection`) REFERENCES `site_connection_types` (`type_id`),
  CONSTRAINT `site_connection_log_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `sites` (`site_id`)
) ENGINE=InnoDB AUTO_INCREMENT=110591 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_connection_types`
--

DROP TABLE IF EXISTS `site_connection_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_connection_types` (
  `type_id` tinyint(4) NOT NULL AUTO_INCREMENT,
  `type` varchar(256) NOT NULL,
  PRIMARY KEY (`type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_data_log`
--

DROP TABLE IF EXISTS `site_data_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_data_log` (
  `log_entry_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `site_id` int(11) unsigned NOT NULL,
  `datetime` datetime NOT NULL,
  `power` tinyint(4) NOT NULL,
  `temp` float NOT NULL,
  `voltage` int(11) NOT NULL,
  `battery` tinyint(4) NOT NULL,
  `status` enum('unknown','charging','not charging','full') NOT NULL,
  `plug_type` tinyint(4) NOT NULL,
  `health` tinyint(4) NOT NULL,
  `bat_tech` tinyint(4) DEFAULT NULL,
  PRIMARY KEY (`log_entry_id`),
  KEY `site_id` (`site_id`,`datetime`),
  KEY `plug_type` (`plug_type`),
  KEY `health` (`health`),
  KEY `bat_tech` (`bat_tech`),
  CONSTRAINT `site_data_log_ibfk_1` FOREIGN KEY (`site_id`) REFERENCES `sites` (`site_id`) ON DELETE CASCADE,
  CONSTRAINT `site_data_log_ibfk_2` FOREIGN KEY (`plug_type`) REFERENCES `site_data_log_plug_types` (`plug_type_id`),
  CONSTRAINT `site_data_log_ibfk_3` FOREIGN KEY (`health`) REFERENCES `site_data_log_health_types` (`health_type_id`),
  CONSTRAINT `site_data_log_ibfk_4` FOREIGN KEY (`bat_tech`) REFERENCES `site_data_log_tech_types` (`tech_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=773758 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_data_log_health_types`
--

DROP TABLE IF EXISTS `site_data_log_health_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_data_log_health_types` (
  `health_type_id` tinyint(4) NOT NULL AUTO_INCREMENT,
  `type` varchar(256) NOT NULL,
  PRIMARY KEY (`health_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_data_log_plug_types`
--

DROP TABLE IF EXISTS `site_data_log_plug_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_data_log_plug_types` (
  `plug_type_id` tinyint(4) NOT NULL AUTO_INCREMENT,
  `type` varchar(256) NOT NULL,
  PRIMARY KEY (`plug_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_data_log_tech_types`
--

DROP TABLE IF EXISTS `site_data_log_tech_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_data_log_tech_types` (
  `tech_type_id` tinyint(4) NOT NULL AUTO_INCREMENT,
  `type` varchar(256) NOT NULL,
  PRIMARY KEY (`tech_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_event_log`
--

DROP TABLE IF EXISTS `site_event_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_event_log` (
  `log_entry_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `site_id` int(10) unsigned NOT NULL,
  `datetime` datetime NOT NULL,
  `type` enum('notice','config','alarm','') NOT NULL,
  `message` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`log_entry_id`),
  KEY `site_id` (`site_id`,`datetime`),
  CONSTRAINT `site_event_log_ibfk_1` FOREIGN KEY (`site_id`) REFERENCES `sites` (`site_id`)
) ENGINE=InnoDB AUTO_INCREMENT=332035 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_log_files`
--

DROP TABLE IF EXISTS `site_log_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_log_files` (
  `site_log_file_id` int(11) NOT NULL AUTO_INCREMENT,
  `site_id` int(10) unsigned NOT NULL,
  `log_start` datetime NOT NULL,
  `log_end` datetime NOT NULL,
  `uri` varchar(256) NOT NULL,
  PRIMARY KEY (`site_log_file_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6421 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `site_types`
--

DROP TABLE IF EXISTS `site_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_types` (
  `site_type_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(40) NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`site_type_id`),
  KEY `type` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sites`
--

DROP TABLE IF EXISTS `sites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sites` (
  `site_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `site_type_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `lat` double NOT NULL,
  `lon` double NOT NULL,
  `alt` double NOT NULL,
  `published` tinyint(1) NOT NULL DEFAULT '0',
  `token_created_on` bigint(20) unsigned DEFAULT NULL,
  `legacy` tinyint(1) DEFAULT '1',
  `external_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`site_id`),
  KEY `site_type_id` (`site_type_id`),
  KEY `project_id` (`project_id`),
  KEY `name` (`name`) USING BTREE,
  CONSTRAINT `sites_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  CONSTRAINT `sites_ibfk_2` FOREIGN KEY (`site_type_id`) REFERENCES `site_types` (`site_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6889 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `songtypes`
--

DROP TABLE IF EXISTS `songtypes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `songtypes` (
  `songtype_id` int(11) NOT NULL AUTO_INCREMENT,
  `songtype` varchar(20) NOT NULL,
  `description` varchar(255) NOT NULL,
  PRIMARY KEY (`songtype_id`),
  UNIQUE KEY `songtype` (`songtype`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `soundscape_aggregation_types`
--

DROP TABLE IF EXISTS `soundscape_aggregation_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `soundscape_aggregation_types` (
  `soundscape_aggregation_type_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `identifier` varchar(255) NOT NULL,
  `name` text NOT NULL,
  `scale` varchar(50) NOT NULL COMMENT 'json array',
  `description` text NOT NULL,
  PRIMARY KEY (`soundscape_aggregation_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `soundscape_composition_class_types`
--

DROP TABLE IF EXISTS `soundscape_composition_class_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `soundscape_composition_class_types` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `soundscape_composition_classes`
--

DROP TABLE IF EXISTS `soundscape_composition_classes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `soundscape_composition_classes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `typeId` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `isSystemClass` tinyint(4) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `typeId` (`typeId`),
  CONSTRAINT `soundscape_composition_classes_ibfk_1` FOREIGN KEY (`typeId`) REFERENCES `soundscape_composition_class_types` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=88 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `soundscape_region_tags`
--

DROP TABLE IF EXISTS `soundscape_region_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=1060 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `soundscape_regions`
--

DROP TABLE IF EXISTS `soundscape_regions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `threshold` float DEFAULT NULL,
  `threshold_type` enum('absolute','relative-to-peak-maximum') DEFAULT NULL,
  PRIMARY KEY (`soundscape_region_id`),
  UNIQUE KEY `sample_playlist_id` (`sample_playlist_id`),
  KEY `soundscape_id` (`soundscape_id`),
  CONSTRAINT `soundscape_regions_ibfk_1` FOREIGN KEY (`soundscape_id`) REFERENCES `soundscapes` (`soundscape_id`) ON DELETE CASCADE,
  CONSTRAINT `soundscape_regions_ibfk_2` FOREIGN KEY (`sample_playlist_id`) REFERENCES `playlists` (`playlist_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2012 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `soundscape_tags`
--

DROP TABLE IF EXISTS `soundscape_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `soundscape_tags` (
  `soundscape_tag_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `tag` varchar(256) NOT NULL,
  `type` enum('normal','species_sound','','') NOT NULL,
  PRIMARY KEY (`soundscape_tag_id`)
) ENGINE=InnoDB AUTO_INCREMENT=88 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `soundscapes`
--

DROP TABLE IF EXISTS `soundscapes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `threshold_type` enum('absolute','relative-to-peak-maximum') NOT NULL DEFAULT 'absolute',
  `normalized` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`soundscape_id`),
  KEY `	soundscape_aggregation_type_id` (`soundscape_aggregation_type_id`),
  CONSTRAINT `soundscapes_ibfk_1` FOREIGN KEY (`soundscape_aggregation_type_id`) REFERENCES `soundscape_aggregation_types` (`soundscape_aggregation_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5849 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `species`
--

DROP TABLE IF EXISTS `species`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `species` (
  `species_id` int(11) NOT NULL AUTO_INCREMENT,
  `scientific_name` varchar(100) NOT NULL,
  `code_name` varchar(10) DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=48571 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `species_aliases`
--

DROP TABLE IF EXISTS `species_aliases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `species_aliases` (
  `alias_id` int(11) NOT NULL AUTO_INCREMENT,
  `species_id` int(11) NOT NULL,
  `alias` varchar(50) NOT NULL,
  PRIMARY KEY (`alias_id`),
  KEY `species_id` (`species_id`),
  KEY `alias` (`alias`),
  CONSTRAINT `species_aliases_ibfk_1` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=42100 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `species_families`
--

DROP TABLE IF EXISTS `species_families`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `species_families` (
  `family_id` int(11) NOT NULL AUTO_INCREMENT,
  `family` varchar(300) NOT NULL,
  `taxon_id` int(11) NOT NULL,
  PRIMARY KEY (`family_id`),
  KEY `taxon_id` (`taxon_id`),
  CONSTRAINT `species_families_ibfk_1` FOREIGN KEY (`taxon_id`) REFERENCES `species_taxons` (`taxon_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=512 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `species_taxons`
--

DROP TABLE IF EXISTS `species_taxons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `species_taxons` (
  `taxon_id` int(11) NOT NULL AUTO_INCREMENT,
  `taxon` varchar(30) NOT NULL,
  `image` varchar(30) NOT NULL,
  `taxon_order` int(11) NOT NULL,
  `enabled` tinyint(11) NOT NULL,
  PRIMARY KEY (`taxon_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `key` varchar(20) NOT NULL,
  `value` text NOT NULL COMMENT 'global system configuration shared accross servers',
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='global system settings shared across servers';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tags`
--

DROP TABLE IF EXISTS `tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tags` (
  `tag_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `tag` varchar(256) NOT NULL,
  PRIMARY KEY (`tag_id`),
  KEY `tag` (`tag`(255))
) ENGINE=InnoDB AUTO_INCREMENT=8719 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `templates`
--

DROP TABLE IF EXISTS `templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `deleted` tinyint(1) DEFAULT '0',
  `source_project_id` INT(10) unsigned DEFAULT NULL,
  `user_id` INT(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`template_id`),
  KEY `fk_templates_1_idx` (`project_id`),
  KEY `fk_templates_2_idx` (`recording_id`),
  KEY `fk_templates_3_idx` (`species_id`),
  KEY `fk_templates_4_idx` (`songtype_id`),
  KEY `fk_templates_5_idx` (`source_project_id`),
  KEY `fk_templates_6_idx` (`user_id`),
  CONSTRAINT `fk_templates_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_templates_2` FOREIGN KEY (`recording_id`) REFERENCES `recordings` (`recording_id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_templates_3` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_templates_4` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_templates_5` FOREIGN KEY (`source_project_id`) REFERENCES `projects` (`project_id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_templates_6` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=3758 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `training_set_roi_set_data`
--

DROP TABLE IF EXISTS `training_set_roi_set_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  CONSTRAINT `training_set_roi_set_data_ibfk_2` FOREIGN KEY (`recording_id`) REFERENCES `recordings` (`recording_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `training_set_roi_set_data_ibfk_3` FOREIGN KEY (`species_id`) REFERENCES `species` (`species_id`),
  CONSTRAINT `training_set_roi_set_data_ibfk_4` FOREIGN KEY (`songtype_id`) REFERENCES `songtypes` (`songtype_id`)
) ENGINE=InnoDB AUTO_INCREMENT=45163 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `training_set_types`
--

DROP TABLE IF EXISTS `training_set_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_set_types` (
  `training_set_type_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `identifier` varchar(255) NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`training_set_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `training_sets`
--

DROP TABLE IF EXISTS `training_sets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `training_sets` (
  `training_set_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `date_created` date NOT NULL,
  `training_set_type_id` int(10) unsigned NOT NULL,
  `removed` tinyint(4) NOT NULL,
  PRIMARY KEY (`training_set_id`),
  KEY `project_id` (`project_id`),
  KEY `training_set_type_id` (`training_set_type_id`),
  KEY `project_id_2` (`project_id`,`name`,`removed`),
  CONSTRAINT `training_sets_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  CONSTRAINT `training_sets_ibfk_2` FOREIGN KEY (`training_set_type_id`) REFERENCES `training_set_types` (`training_set_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2685 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `training_sets_roi_set`
--

DROP TABLE IF EXISTS `training_sets_roi_set`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `uploads_processing` (
  `upload_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `site_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned DEFAULT NULL,
  `upload_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `filename` varchar(100) NOT NULL,
  `state` varchar(45) NOT NULL,
  `duration` float NOT NULL,
  `datetime` datetime DEFAULT NULL,
  `recorder` varchar(45) DEFAULT NULL,
  `mic` varchar(45) DEFAULT NULL,
  `software` varchar(45) DEFAULT NULL,
  `remark` text,
  PRIMARY KEY (`upload_id`),
  KEY `project_id` (`project_id`),
  KEY `site_id` (`site_id`),
  KEY `user_id` (`user_id`),
  KEY `upload_time` (`upload_time`),
  KEY `filename` (`filename`),
  CONSTRAINT `uploads_processing_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `uploads_processing_ibfk_2` FOREIGN KEY (`site_id`) REFERENCES `sites` (`site_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6588994 DEFAULT CHARSET=utf8 COMMENT='recording uploaded and being process';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_account_support_request`
--

DROP TABLE IF EXISTS `user_account_support_request`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_account_support_request` (
  `support_request_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned DEFAULT NULL,
  `support_type_id` int(10) unsigned NOT NULL,
  `hash` varchar(64) NOT NULL,
  `params` text,
  `consumed` tinyint(1) NOT NULL DEFAULT '0',
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `expires` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`support_request_id`),
  UNIQUE KEY `hash` (`hash`),
  KEY `user_id` (`user_id`),
  KEY `support_type_id` (`support_type_id`),
  CONSTRAINT `user_account_support_request_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `user_account_support_request_ibfk_2` FOREIGN KEY (`support_type_id`) REFERENCES `user_account_support_type` (`account_support_type_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2331 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_account_support_type`
--

DROP TABLE IF EXISTS `user_account_support_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_account_support_type` (
  `account_support_type_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `max_lifetime` int(11) DEFAULT NULL COMMENT 'maximum lifetime in seconds of this support type',
  PRIMARY KEY (`account_support_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_project_role`
--

DROP TABLE IF EXISTS `user_project_role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_project_role` (
  `user_id` int(10) unsigned NOT NULL,
  `project_id` int(10) unsigned NOT NULL,
  `role_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`user_id`,`project_id`),
  KEY `project_id` (`project_id`),
  KEY `role_id` (`role_id`),
  KEY `user_id` (`user_id`),
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
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `login` varchar(32) NOT NULL,
  `password` varchar(64) NOT NULL,
  `firstname` varchar(255) NOT NULL,
  `lastname` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `last_login` datetime DEFAULT NULL,
  `is_super` tinyint(1) NOT NULL DEFAULT '0',
  `project_limit` int(10) unsigned NOT NULL DEFAULT '100',
  `created_on` datetime DEFAULT NULL,
  `login_tries` tinyint(3) unsigned NOT NULL DEFAULT '0',
  `disabled_until` datetime DEFAULT NULL,
  `oauth_google` tinyint(4) NOT NULL DEFAULT '0',
  `oauth_facebook` tinyint(4) NOT NULL DEFAULT '0',
  `rfcx_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `login` (`login`)
) ENGINE=InnoDB AUTO_INCREMENT=1581 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `validation_set`
--

DROP TABLE IF EXISTS `validation_set`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  CONSTRAINT `validation_set_ibfk_1` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`job_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4425 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Final view structure for view `job_stats_by_month`
--

/*!50001 DROP VIEW IF EXISTS `job_stats_by_month`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8 */;
/*!50001 SET character_set_results     = utf8 */;
/*!50001 SET collation_connection      = utf8_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`admin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `job_stats_by_month` AS select cast(date_format(`jobs`.`date_created`,'%Y-%m-01') as date) AS `month_date`,count(0) AS `jobs`,`jobs`.`job_type_id` AS `job_type_id`,`jobs`.`state` AS `state`,sum(`jobs`.`progress`) AS `job_steps`,sum(ceiling((timestampdiff(SECOND,`jobs`.`date_created`,`jobs`.`last_update`) / 3600))) AS `job_hours` from `jobs` group by year(`jobs`.`date_created`),month(`jobs`.`date_created`),`jobs`.`job_type_id`,`jobs`.`state` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `project_plan_owner`
--

/*!50001 DROP VIEW IF EXISTS `project_plan_owner`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8 */;
/*!50001 SET character_set_results     = utf8 */;
/*!50001 SET collation_connection      = utf8_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`admin`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `project_plan_owner` AS select `P`.`name` AS `name`,`U`.`firstname` AS `firstname`,`U`.`lastname` AS `lastname`,`U`.`email` AS `email`,`PP`.`created_on` AS `plan_date`,`PP`.`tier` AS `tier`,`PP`.`storage` AS `storage`,`PP`.`processing` AS `processing` from (((`projects` `P` join `project_plans` `PP` on((`P`.`current_plan` = `PP`.`plan_id`))) join `user_project_role` `UPR` on(((`UPR`.`project_id` = `P`.`project_id`) and (`UPR`.`role_id` = 4)))) join `users` `U` on((`U`.`user_id` = `UPR`.`user_id`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2020-10-22 12:26:23
