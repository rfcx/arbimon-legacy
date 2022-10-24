ALTER TABLE `arbimon2`.`job_params_audio_event_detection_clustering`
ADD COLUMN `deleted` tinyint(1) NOT NULL DEFAULT '0';

ALTER TABLE `arbimon2`.`job_params_audio_event_clustering`
ADD COLUMN `deleted` tinyint(1) NOT NULL DEFAULT '0';

INSERT INTO `arbimon2`.`permissions` (name, description, security_level)
VALUES ('manage AED and Clustering job', 'user can create, delete and validate AED and Clustering job', 0);


INSERT INTO `arbimon2`.`role_permissions` (role_id, permission_id)
VALUES
    (1, 25),
    (4, 25),
    (6, 25);
