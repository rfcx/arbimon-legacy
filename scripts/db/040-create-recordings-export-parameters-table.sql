CREATE TABLE `arbimon2`.`recordings_export_parameters` (
  `project_id` int(10) NOT NULL,
  `user_id` int(11) NOT NULL,
  `date_created` datetime NOT NULL,
  `projection_parameters` text NOT NULL, 
--   VARCHAR(255) DEFAULT NULL
  `filters` text NOT NULL,
  `processed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX processed_at ON recordings_export_parameters(processed_at);
