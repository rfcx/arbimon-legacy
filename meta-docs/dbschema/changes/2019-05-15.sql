CREATE TABLE `arbimon2`.`pattern_matching_user_statistics` (
  `user_statistics_id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `project_id` INT UNSIGNED NOT NULL,
  `species_id` INT NOT NULL,
  `songtype_id` INT NOT NULL,
  `validated` INT NOT NULL,
  `correct` INT NOT NULL,
  `incorrect` INT NOT NULL,
  `confidence` FLOAT NOT NULL,
  `last_update` TIMESTAMP NOT NULL,
  PRIMARY KEY (`user_statistics_id`)
);


ALTER TABLE `arbimon2`.`pattern_matching_user_statistics`
ADD CONSTRAINT `fk_pattern_matching_user_statistics_1`
    FOREIGN KEY (`user_id`) REFERENCES `arbimon2`.`users` (`user_id`)
    ON DELETE NO ACTION ON UPDATE NO ACTION
;

ALTER TABLE `arbimon2`.`pattern_matching_user_statistics`
ADD CONSTRAINT `fk_pattern_matching_user_statistics_2`
    FOREIGN KEY (`project_id`) REFERENCES `arbimon2`.`projects` (`project_id`)
    ON DELETE NO ACTION ON UPDATE NO ACTION
;

ALTER TABLE `arbimon2`.`pattern_matching_user_statistics`
ADD CONSTRAINT `fk_pattern_matching_user_statistics_3`
    FOREIGN KEY (`species_id`) REFERENCES `arbimon2`.`species` (`species_id`)
    ON DELETE NO ACTION ON UPDATE NO ACTION
;

ALTER TABLE `arbimon2`.`pattern_matching_user_statistics`
ADD CONSTRAINT `fk_pattern_matching_user_statistics_4`
    FOREIGN KEY (`songtype_id`) REFERENCES `arbimon2`.`songtypes` (`songtype_id`)
    ON DELETE NO ACTION ON UPDATE NO ACTION
;
