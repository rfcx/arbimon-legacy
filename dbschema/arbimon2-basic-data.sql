-- phpMyAdmin SQL Dump
-- version 4.0.10deb1
-- http://www.phpmyadmin.net
--
-- Host: localhost
-- Generation Time: Nov 09, 2014 at 06:49 PM
-- Server version: 5.5.40-0ubuntu0.14.04.1
-- PHP Version: 5.5.9-1ubuntu4.5

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

--
-- Database: `arbimon2`
--

--
-- Dumping data for table `job_types`
--

INSERT INTO `job_types` (`job_type_id`, `name`, `identifier`, `description`) VALUES
(1, 'Model Training', 'training', 'Fitting of a model using training data. Model results are then validated using a validation data set.'),
(2, 'Model Classification', 'classification', 'Classification of project data using a specified model and parameters.');


--
-- Dumping data for table `permissions`
--

INSERT INTO `permissions` (`permission_id`, `name`, `description`, `security_level`) VALUES
(1, 'view project', 'user can view project execept settings, user access and billing sections', 0),
(2, 'delete project', 'user can delete a project from system, this permission is only available to the project owner', 0),
(4, 'manage project billing', 'user can view and edit project billing info', 0),
(5, 'manage project settings', 'user can edit project info, settings and user access', 0),
(6, 'manage project sites', 'user can view edit and remove sites from project', 0),
(7, 'manage project species', 'user can add and remove species from project species list', 0),
(8, 'manage project playlists', 'user can edit and delete project playlists', 0),
(9, 'manage project recordings', 'user can upload, edit and remove recordings', 0),
(10, 'manage project jobs', 'user can view jobs and cancel them', 0),
(11, 'validate species', 'user can validate species in project recordings', 0),
(12, 'invalidate species', 'user can invalidate species from project recordings', 0),
(13, 'manage models and classification', 'user can create, edit and run models', 0),
(14, 'manage validation sets', 'user can create, edit and delete validation sets', 0),
(15, 'manage training sets', 'user can create, edit and delete training sets', 0);

--
-- Dumping data for table `project_news_types`
--

INSERT INTO `project_news_types` (`news_type_id`, `name`, `description`) VALUES
(1, 'project created', 'A user created a project'),
(2, 'site created', 'a site was created in the project');

--
-- Dumping data for table `project_types`
--

INSERT INTO `project_types` (`project_type_id`, `name`, `description`) VALUES
(1, 'testType', 'testing type');

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`role_id`, `name`, `description`, `icon`) VALUES
(1, 'Admin', 'Project Administrator - can do anything but delete the project', ''),
(2, 'User', 'Normal user - can do anything except manage settings, billing or delete the project', ''),
(3, 'Guest ', 'Guest user - can only view the project', ''),
(4, 'Owner', 'Project Owner - can do anything on the project', ''),
(5, 'Data Entry', 'Data Entry user - can manage project data but can not view or edit settings nor make models and classification', ''),
(6, 'Expert', 'Expert User - can do anything a user can do plus can invalidate species from recordings', '');

--
-- Dumping data for table `role_permissions`
--

INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES
(1, 1),
(2, 1),
(3, 1),
(4, 1),
(5, 1),
(6, 1),
(4, 2),
(4, 4),
(1, 5),
(4, 5),
(1, 6),
(2, 6),
(4, 6),
(5, 6),
(6, 6),
(1, 7),
(2, 7),
(4, 7),
(5, 7),
(6, 7),
(1, 8),
(2, 8),
(4, 8),
(6, 8),
(1, 9),
(2, 9),
(4, 9),
(5, 9),
(6, 9),
(1, 10),
(2, 10),
(4, 10),
(6, 10),
(1, 11),
(2, 11),
(4, 11),
(6, 11),
(1, 12),
(4, 12),
(6, 12),
(1, 13),
(2, 13),
(4, 13),
(6, 13),
(1, 14),
(2, 14),
(4, 14),
(6, 14),
(1, 15),
(2, 15),
(4, 15),
(6, 15);

--
-- Dumping data for table `site_types`
--

INSERT INTO `site_types` (`site_type_id`, `name`, `description`) VALUES
(1, 'Permanent Recording Station', 'A fixed installation that generates recordings and other events, which it later sends to a base station'),
(2, 'Mobile Recorder', 'A mobile device that gets sent into the field and generates recordings and other events, but later needs to be picked up and it''s data extracted manually.');

--
-- Dumping data for table `training_set_types`
--

INSERT INTO `training_set_types` (`training_set_type_id`, `name`, `identifier`, `description`) VALUES
(1, 'ROI set', 'roi_set', 'A set of regions of interest in different recordings in the project');

--
-- Dumping data for table `user_account_support_type`
--

INSERT INTO `user_account_support_type` (`account_support_type_id`, `name`, `description`, `max_lifetime`) VALUES
(1, 'account_activation', 'Activates a new user''s account.', 259200),
(2, 'password_recovery', 'Allows a user to change it''s forgotten passwords', 86400);

--
-- Dumping data for table `model_types`
--

INSERT INTO `model_types` (`model_type_id`, `name`, `description`, `training_set_type_id`) VALUES
(1, 'Pattern Matching', 'Pattern Matching using ROIs', 1);


