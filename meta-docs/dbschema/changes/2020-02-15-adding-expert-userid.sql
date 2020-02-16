
ALTER TABLE `arbimon2`.`pattern_matching_rois`
    ADD COLUMN `expert_validation_user_id` INT(11) NULL AFTER `expert_validated`;
