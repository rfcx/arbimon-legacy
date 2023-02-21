CREATE TABLE `arbimon2`.`recordings_export_parameters` (
  `project_id` int(10) NOT NULL,
  `user_id` int(11) NOT NULL,
  `projection_parameters` text NOT NULL, 
  `filters` VARCHAR(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL
);

CREATE INDEX processed_at_idx ON recordings_export_parameters(processed_at);
CREATE INDEX created_at_idx ON recordings_export_parameters(created_at);
