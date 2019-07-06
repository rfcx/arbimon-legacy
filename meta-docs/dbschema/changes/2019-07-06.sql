ALTER TABLE `arbimon2`.`pattern_matching_rois`
ADD COLUMN `cs_val_present` INT NOT NULL DEFAULT 0 COMMENT 'current count of cs present votes' AFTER `validated`,
ADD COLUMN `cs_val_not_present` INT NOT NULL DEFAULT 0 COMMENT 'current count of cs not present votes' AFTER `cs_val_present`;


--  update current pmr cs p/np counts
UPDATE pattern_matching_rois
    JOIN pattern_matchings ON pattern_matching_rois.pattern_matching_id = pattern_matchings.pattern_matching_id
    LEFT JOIN (
        SELECT _PMV.pattern_matching_roi_id,
            SUM(IF(_PMV.validated = 1, 1, 0)) as cs_val_present,
            SUM(IF(_PMV.validated = 0, 1, 0)) as cs_val_not_present
        FROM pattern_matching_validations _PMV
        GROUP BY _PMV.pattern_matching_roi_id
    ) AS PMV ON PMV.pattern_matching_roi_id = pattern_matching_rois.pattern_matching_roi_id
SET
    pattern_matching_rois.cs_val_present = COALESCE(PMV.cs_val_present, 0),
    pattern_matching_rois.cs_val_not_present = COALESCE(PMV.cs_val_not_present, 0),
    pattern_matching_rois.consensus_validated = (CASE
        WHEN PMV.cs_val_present >= pattern_matchings.consensus_number THEN 1
        WHEN PMV.cs_val_not_present >= pattern_matchings.consensus_number THEN 0
        ELSE NULL
    END)
;
