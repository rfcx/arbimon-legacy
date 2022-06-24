ALTER TABLE `arbimon2`.`recording_validations`
ADD COLUMN `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

CREATE TRIGGER recording_validations_update BEFORE UPDATE ON `arbimon2`.`recording_validations` FOR EACH ROW SET NEW.updated_at = NOW();
