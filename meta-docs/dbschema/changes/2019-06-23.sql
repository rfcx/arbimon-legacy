ALTER TABLE `arbimon2`.`pattern_matchings`
ADD COLUMN `consensus_number` INT(11) NOT NULL DEFAULT 3 AFTER `citizen_scientist`;

ALTER TABLE `arbimon2`.`projects`
DROP COLUMN `citizen_scientist_validation_consensus_number`;
