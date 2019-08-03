
-- remove deleted pattern matchings from cs interface
UPDATE arbimon2.pattern_matchings SET citizen_scientist=0 WHERE deleted=1;

-- adding pattermatching enable flag
ALTER TABLE `arbimon2`.`projects`
ADD COLUMN `pattern_matching_enabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `processing_usage`;
