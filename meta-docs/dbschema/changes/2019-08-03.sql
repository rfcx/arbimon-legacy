
-- remove deleted pattern matchings from cs interface
UPDATE arbimon2.pattern_matchings SET citizen_scientist=0 WHERE deleted=1;
