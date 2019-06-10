ALTER TABLE `arbimon2`.`pattern_matching_user_statistics`
ADD UNIQUE INDEX `uk_pattern_matching_user_statistics_1` (`user_id` ASC, `project_id` ASC, `species_id` ASC, `songtype_id` ASC);
;
