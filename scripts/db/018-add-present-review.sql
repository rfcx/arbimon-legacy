ALTER TABLE `arbimon2`.`recording_validations` 
ADD COLUMN `present_review` INT NOT NULL DEFAULT 0 AFTER `present`;
ALTER TABLE recording_validations MODIFY present TINYINT(1) NULL;
