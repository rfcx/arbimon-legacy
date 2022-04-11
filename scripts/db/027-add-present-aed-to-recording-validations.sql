ALTER TABLE `arbimon2`.`recording_validations` 
ADD COLUMN `present_aed` INT NOT NULL DEFAULT 0 AFTER `present_review`;
