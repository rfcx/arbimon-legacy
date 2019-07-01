ALTER TABLE `arbimon2`.`pattern_matching_rois`
ADD COLUMN `expert_validated` TINYINT(1) NULL DEFAULT NULL AFTER `consensus_validated`;
