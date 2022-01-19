DROP TABLE IF EXISTS `detections_sync_jobs`;
CREATE TABLE `detections_sync_jobs` (
  `id` varchar(32) NOT NULL,
  `detections_processed` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
