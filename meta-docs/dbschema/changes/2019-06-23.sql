ALTER TABLE `arbimon2`.`pattern_matchings`
ADD COLUMN `consensus_number` INT(11) NOT NULL DEFAULT 3 AFTER `citizen_scientist`;
