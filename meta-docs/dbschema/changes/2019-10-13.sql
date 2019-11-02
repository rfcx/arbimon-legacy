ALTER TABLE `arbimon2`.`pattern_matchings`
    ADD COLUMN `cs_expert` TINYINT(1) NOT NULL AFTER `consensus_number`;
