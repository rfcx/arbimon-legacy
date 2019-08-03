
-- remove deleted pattern matchings from cs interface
UPDATE arbimon2.pattern_matchings SET citizen_scientist=0 WHERE deleted=1;

-- adding pattermatching enable flag
ALTER TABLE `arbimon2`.`projects`
ADD COLUMN `pattern_matching_enabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `processing_usage`;

-- clean up stuck uploaded recordings before aug 1 2019
UPDATE arbimon2.uploads_processing SET state='error' WHERE upload_time < '2019-08-01' AND state != 'uploaded';
