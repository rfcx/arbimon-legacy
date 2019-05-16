ALTER TABLE `arbimon2`.`pattern_matching_rois`
ADD COLUMN `consensus_validated` TINYINT(1) NULL DEFAULT NULL AFTER `validated`;


CREATE TABLE `arbimon2`.`pattern_matching_validations` (
  `validation_id` INT NOT NULL AUTO_INCREMENT,
  `pattern_matching_id` INT NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `timestamp` TIMESTAMP NOT NULL,
  `validated` INT NOT NULL,
  PRIMARY KEY (`validation_id`));


  ALTER TABLE `arbimon2`.`pattern_matching_validations`
  ADD CONSTRAINT `fk_pattern_matching_validations_1`
    FOREIGN KEY (`pattern_matching_id`)
    REFERENCES `arbimon2`.`pattern_matchings` (`pattern_matching_id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_pattern_matching_validations_2`
    FOREIGN KEY (`user_id`)
    REFERENCES `arbimon2`.`users` (`user_id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;
