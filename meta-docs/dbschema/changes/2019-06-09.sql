ALTER TABLE `arbimon2`.`pattern_matching_user_statistics`
ADD UNIQUE INDEX `uk_pattern_matching_user_statistics_1` (`user_id` ASC, `project_id` ASC, `species_id` ASC, `songtype_id` ASC);
;

INSERT INTO `arbimon2`.`roles` (`name`, `description`, `level`) VALUES ('Citizen Scientist', 'Citizen Scientist - User can only see the Citizen Scientist interface and add validattions to the pattern matchings', '6');
UPDATE `arbimon2`.`roles` SET `level` = '7' WHERE (`role_id` = '3');



INSERT INTO `arbimon2`.`permissions` (`name`, `description`, `security_level`) VALUES ('use citizen scientist interface', 'user can validate pattern matchings through the citizen scientist interface', '0');
