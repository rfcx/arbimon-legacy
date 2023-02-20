CREATE TABLE `arbimon2`.`recordings_export_parameters` (
  `project_id` int(10) NOT NULL,
  `user_id` int(11) NOT NULL,
  `date_created` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `projection_parameters` text NOT NULL, 
  `filters` VARCHAR(255) NOT NULL,
  `processed_at` datetime NOT NULL DEFAULT NULL
);

CREATE INDEX processed_at ON recordings_export_parameters(processed_at);
