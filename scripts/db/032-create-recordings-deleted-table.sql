CREATE TABLE `arbimon2`.`recordings_deleted` (
  `recording_id` bigint(20) unsigned NOT NULL,
  `site_id` int(10) unsigned NOT NULL,
  `datetime` datetime NOT NULL,
  `duration` float DEFAULT NULL,
  `deleted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX deleted_at ON recordings_deleted(deleted_at);
