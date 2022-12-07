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
-- Dumping data for table `job_types`
--

/*!40000 ALTER TABLE `job_types` DISABLE KEYS */;
INSERT INTO `job_types` VALUES (1,'Model training','training','Fitting of a model using training data. Model results are then validated using a validation data set.',1,'PatternMatching/train.py','manual');
INSERT INTO `job_types` VALUES (2,'Model classification','classification','Classification of project data using a specified model and parameters.',1,'PatternMatching/classification.py','script');
INSERT INTO `job_types` VALUES (4,'Soundscape analysis','peak-soundscape','The creation of a peak soundscape using a playlist, an aggregation function and a thershold or peak limiting value.',1,'Soundscapes/playlist2soundscape.py','script');
INSERT INTO `job_types` VALUES (5,'Audio Event Detection','audio-event-detection','Detection of audio events from recordings in a given playlist.',1,'AudioEventDetection/audio_event_detection.py','script');
INSERT INTO `job_types` VALUES (6,'Pattern Matching','pattern-matching','Matching of template roi on recordings on a playlist',0,'PatternMatching/pattern_matching.py','');
INSERT INTO `job_types` VALUES (7,'Convolutional Neural Network','cnn','Convolutional neural network based detections and verifications.',0,'CNN/cnn.py','');
/*!40000 ALTER TABLE `job_types` ENABLE KEYS */;

--
-- Dumping data for table `training_set_types`
--

/*!40000 ALTER TABLE `training_set_types` DISABLE KEYS */;
INSERT INTO `training_set_types` VALUES (1,'ROI set','roi_set','Regions of interest (ROI) used to create a pattern matching model');
/*!40000 ALTER TABLE `training_set_types` ENABLE KEYS */;

--
-- Dumping data for table `model_types`
--

/*!40000 ALTER TABLE `model_types` DISABLE KEYS */;
INSERT INTO `model_types` VALUES (1,'Pattern Matching (slow)','Pattern Matching using ROIs. Matrix comparisons computed using SSIM (Structural similarity index measurement).',1,1,0,0);
INSERT INTO `model_types` VALUES (2,'Pattern Matching (fast)','Pattern Matching using ROIs. Matrix comparisons computed using matrix norms.',1,0,0,0);
INSERT INTO `model_types` VALUES (3,'Search and Match','Pattern Matching using ROIs. Search interesting areas and compute matrix comparisons using SSIM (Structural similarity index).',1,0,1,0);
INSERT INTO `model_types` VALUES (4,'Pattern Matching with Random Forests','Pattern Matching using OpenCV matchTemplate procedure and a trained Random Forest.',1,0,0,1);
/*!40000 ALTER TABLE `model_types` ENABLE KEYS */;

--
-- Dumping data for table `permissions`
--

/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'view project','user can view project execept settings, user access and billing sections',0);
INSERT INTO `permissions` VALUES (2,'delete project','user can delete a project from system, this permission is only available to the project owner',0);
INSERT INTO `permissions` VALUES (4,'manage project billing','user can view and edit project billing info',0);
INSERT INTO `permissions` VALUES (5,'manage project settings','user can edit project info, settings and user access',0);
INSERT INTO `permissions` VALUES (6,'manage project sites','user can view and edit project sites',0);
INSERT INTO `permissions` VALUES (7,'manage project species','user can add and remove species from project species list',0);
INSERT INTO `permissions` VALUES (8,'manage playlists','user can edit and delete project playlists',0);
INSERT INTO `permissions` VALUES (9,'manage project recordings','user can upload, edit and remove recordings',0);
INSERT INTO `permissions` VALUES (10,'manage project jobs','user can view jobs and cancel them',0);
INSERT INTO `permissions` VALUES (11,'validate species','user can validate species in project recordings',0);
INSERT INTO `permissions` VALUES (12,'invalidate species','user can invalidate species from project recordings',0);
INSERT INTO `permissions` VALUES (13,'manage models and classification','user can create, edit and run models',0);
INSERT INTO `permissions` VALUES (14,'manage validation sets','user can create, edit and delete validation sets',0);
INSERT INTO `permissions` VALUES (15,'manage training sets','user can create, edit and delete training sets',0);
INSERT INTO `permissions` VALUES (16,'manage soundscapes','user can create and work with soundscapes',0);
INSERT INTO `permissions` VALUES (17,'manage templates','user can create templates',0);
INSERT INTO `permissions` VALUES (18,'manage pattern matchings','user can create pattern matchings',0);
INSERT INTO `permissions` VALUES (19,'validate pattern matchings','user can validate matches in a pattern matching',0);
INSERT INTO `permissions` VALUES (20,'use citizen scientist interface','user can validate pattern matchings through the citizen scientist interface',0);
INSERT INTO `permissions` VALUES (23,'view citizen scientist expert interface','user can view citizen scientist expert interface',0);
INSERT INTO `permissions` VALUES (24,'view citizen scientist admin interface','user can view citizen scientist admin interface',0);
INSERT INTO `permissions` VALUES (25,'manage AED and Clustering job', 'user can create, delete and validate AED and Clustering job', 0);
INSERT INTO `permissions` VALUES (26,'delete site','user can delete a site', 0);
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;

--
-- Dumping data for table `playlist_types`
--

/*!40000 ALTER TABLE `playlist_types` DISABLE KEYS */;
INSERT INTO `playlist_types` VALUES (1,'normal');
INSERT INTO `playlist_types` VALUES (2,'soundscape region');
INSERT INTO `playlist_types` VALUES (3,'union');
INSERT INTO `playlist_types` VALUES (4,'intersection');
INSERT INTO `playlist_types` VALUES (5,'subtraction');
/*!40000 ALTER TABLE `playlist_types` ENABLE KEYS */;

--
-- Dumping data for table `project_news_types`
--

/*!40000 ALTER TABLE `project_news_types` DISABLE KEYS */;
INSERT INTO `project_news_types` VALUES (1,'project created','A user created a project','created project \"%(project)s\"');
INSERT INTO `project_news_types` VALUES (2,'site created','a site was created in the project','added site \"%(site)s\" to project \"%(project)s\"');
INSERT INTO `project_news_types` VALUES (3,'site updated','user updated site ','updated site \"%(site)s\" on project \"%(project)s\"');
INSERT INTO `project_news_types` VALUES (4,'site deleted','user deleted site','deleted sites \"%(sites)s\" from project \"%(project)s\"');
INSERT INTO `project_news_types` VALUES (5,'class added','user added a species song','added \"%(species)s %(song)s\" to project \"%(project)s\" species');
INSERT INTO `project_news_types` VALUES (6,'class removed','user removed a species song','removed \"%(classes)s\" from project \"%(project)s\" species');
INSERT INTO `project_news_types` VALUES (7,'training set created','Training set created ','created training set \"%(training_set)s\" on project \"%(project)s\"');
INSERT INTO `project_news_types` VALUES (8,'model trained ','user created and train a model','created model \"%(model)s\" with the training set \"%(training_set)s\" on project %(project)s');
INSERT INTO `project_news_types` VALUES (9,'model run','user run a model over a set of recordings','run classification \"%(classi)s\" of model\"%(model)s\" on project \"%(project)s\"');
INSERT INTO `project_news_types` VALUES (10,'playlist created','user created a playlist','created playlist \"%(playlist)s\" on project \"%(project)s\"');
INSERT INTO `project_news_types` VALUES (11,'soundscape created','user created soundscape','created soundscape \"%(soundscape)s\" on project \"%(project)s\"');
INSERT INTO `project_news_types` VALUES (12,'training set edited','Training set edited','edited training set \"%(training_set)s\" on project \"%(project)s\"');
INSERT INTO `project_news_types` VALUES (13,'training set removed','Training set removed','removed training set \"%(training_set)s\" from project \"%(project)s\"');
/*!40000 ALTER TABLE `project_news_types` ENABLE KEYS */;

--
-- Dumping data for table `project_types`
--

/*!40000 ALTER TABLE `project_types` DISABLE KEYS */;
INSERT INTO `project_types` VALUES (1,'testType','testing type');
/*!40000 ALTER TABLE `project_types` ENABLE KEYS */;

--
-- Dumping data for table `roles`
--

/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'Admin','Project Administrator - can do anything but delete the project','',2);
INSERT INTO `roles` VALUES (2,'User','Normal user - can do anything except manage settings, billing or delete the project','',4);
INSERT INTO `roles` VALUES (3,'Guest ','Guest user - can only view the project','',7);
INSERT INTO `roles` VALUES (4,'Owner','Project Owner - can do anything on the project','',1);
INSERT INTO `roles` VALUES (5,'Data Entry','Data Entry user - can manage project data but can only view the analysis section','',5);
INSERT INTO `roles` VALUES (6,'Expert','Expert User - can do anything a user can do plus can invalidate species from recordings','',3);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;

--
-- Dumping data for table `role_permissions`
--

/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES (1,1);
INSERT INTO `role_permissions` VALUES (2,1);
INSERT INTO `role_permissions` VALUES (3,1);
INSERT INTO `role_permissions` VALUES (4,1);
INSERT INTO `role_permissions` VALUES (5,1);
INSERT INTO `role_permissions` VALUES (6,1);
INSERT INTO `role_permissions` VALUES (4,2);
INSERT INTO `role_permissions` VALUES (4,4);
INSERT INTO `role_permissions` VALUES (1,5);
INSERT INTO `role_permissions` VALUES (4,5);
INSERT INTO `role_permissions` VALUES (1,6);
INSERT INTO `role_permissions` VALUES (4,6);
INSERT INTO `role_permissions` VALUES (6,6);
INSERT INTO `role_permissions` VALUES (1,7);
INSERT INTO `role_permissions` VALUES (2,7);
INSERT INTO `role_permissions` VALUES (4,7);
INSERT INTO `role_permissions` VALUES (5,7);
INSERT INTO `role_permissions` VALUES (6,7);
INSERT INTO `role_permissions` VALUES (1,8);
INSERT INTO `role_permissions` VALUES (2,8);
INSERT INTO `role_permissions` VALUES (4,8);
INSERT INTO `role_permissions` VALUES (6,8);
INSERT INTO `role_permissions` VALUES (1,9);
INSERT INTO `role_permissions` VALUES (4,9);
INSERT INTO `role_permissions` VALUES (5,9);
INSERT INTO `role_permissions` VALUES (6,9);
INSERT INTO `role_permissions` VALUES (1,10);
INSERT INTO `role_permissions` VALUES (2,10);
INSERT INTO `role_permissions` VALUES (4,10);
INSERT INTO `role_permissions` VALUES (6,10);
INSERT INTO `role_permissions` VALUES (1,11);
INSERT INTO `role_permissions` VALUES (4,11);
INSERT INTO `role_permissions` VALUES (6,11);
INSERT INTO `role_permissions` VALUES (4,12);
INSERT INTO `role_permissions` VALUES (1,13);
INSERT INTO `role_permissions` VALUES (4,13);
INSERT INTO `role_permissions` VALUES (6,13);
INSERT INTO `role_permissions` VALUES (4,14);
INSERT INTO `role_permissions` VALUES (1,15);
INSERT INTO `role_permissions` VALUES (4,15);
INSERT INTO `role_permissions` VALUES (6,15);
INSERT INTO `role_permissions` VALUES (1,16);
INSERT INTO `role_permissions` VALUES (4,16);
INSERT INTO `role_permissions` VALUES (6,16);
INSERT INTO `role_permissions` VALUES (1,17);
INSERT INTO `role_permissions` VALUES (4,17);
INSERT INTO `role_permissions` VALUES (6,17);
INSERT INTO `role_permissions` VALUES (1,18);
INSERT INTO `role_permissions` VALUES (4,18);
INSERT INTO `role_permissions` VALUES (6,18);
INSERT INTO `role_permissions` VALUES (1,19);
INSERT INTO `role_permissions` VALUES (4,19);
INSERT INTO `role_permissions` VALUES (6,19);
INSERT INTO `role_permissions` VALUES (1,20);
INSERT INTO `role_permissions` VALUES (2,20);
INSERT INTO `role_permissions` VALUES (3,20);
INSERT INTO `role_permissions` VALUES (4,20);
INSERT INTO `role_permissions` VALUES (5,20);
INSERT INTO `role_permissions` VALUES (6,20);
INSERT INTO `role_permissions` VALUES (1,21);
INSERT INTO `role_permissions` VALUES (1,22);
INSERT INTO `role_permissions` VALUES (1,23);
INSERT INTO `role_permissions` VALUES (4,23);
INSERT INTO `role_permissions` VALUES (6,23);
INSERT INTO `role_permissions` VALUES (1,24);
INSERT INTO `role_permissions` VALUES (4,24);
INSERT INTO `role_permissions` VALUES (1, 25), (4, 25), (6, 25);
INSERT INTO `role_permissions` VALUES (1, 26), (4, 26), (6, 26), (2, 6);
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;

--
-- Dumping data for table `site_types`
--

/*!40000 ALTER TABLE `site_types` DISABLE KEYS */;
INSERT INTO `site_types` VALUES (1,'Permanent Recording Station','A fixed installation that generates recordings and other events, which it later sends to a base station');
INSERT INTO `site_types` VALUES (2,'Mobile Recorder','A mobile device that gets sent into the field and generates recordings and other events, but later needs to be picked up and it\'s data extracted manually.');
/*!40000 ALTER TABLE `site_types` ENABLE KEYS */;

--
-- Dumping data for table `soundscape_aggregation_types`
--

/*!40000 ALTER TABLE `soundscape_aggregation_types` DISABLE KEYS */;
INSERT INTO `soundscape_aggregation_types` VALUES (1,'time_of_day','Hour of the day','[\"00:00\", \"01:00\", \"......\", \"22:00\", \"23:00\"]','Aggregates the data by each hour of the day');
INSERT INTO `soundscape_aggregation_types` VALUES (2,'day_of_month','Day of the month','[\"1\", \"2\", \"......\", \"30\", \"31\"]','Aggregates the data by each day of the month');
INSERT INTO `soundscape_aggregation_types` VALUES (3,'day_of_year','Day of the year','[\"1\", \"2\", \"......\", \"365\", \"366\"]','Aggregates the data by each day of the year');
INSERT INTO `soundscape_aggregation_types` VALUES (4,'month_in_year','Month of the year','[\"Jan\", \"Feb\", \"......\", \"Nov\", \"Dec\"]','Aggregates the data by each month of the year');
INSERT INTO `soundscape_aggregation_types` VALUES (5,'day_of_week','Day of the week','[\"Sun\", \"Mon\", \"......\", \"Fri\", \"Sat\"]','Aggregates the data by each day of the week');
INSERT INTO `soundscape_aggregation_types` VALUES (6,'year','Year by year','[\"2010\", \"2011\", \"......\", \"2016\", \"2017\"]','Aggregates the data by each year');
/*!40000 ALTER TABLE `soundscape_aggregation_types` ENABLE KEYS */;

--
-- Dumping data for table `user_account_support_type`
--

/*!40000 ALTER TABLE `user_account_support_type` DISABLE KEYS */;
INSERT INTO `user_account_support_type` VALUES (1,'account_activation','Activates a new user\'s account.',259200);
INSERT INTO `user_account_support_type` VALUES (2,'password_recovery','Allows a user to change it\'s forgotten passwords',86400);
/*!40000 ALTER TABLE `user_account_support_type` ENABLE KEYS */;

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
