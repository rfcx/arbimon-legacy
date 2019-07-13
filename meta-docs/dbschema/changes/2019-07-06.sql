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

ALTER TABLE `arbimon2`.`pattern_matching_user_statistics`
ADD COLUMN `pending` INT NOT NULL DEFAULT 0 AFTER `incorrect`;

--  update current user pending counts
INSERT INTO pattern_matching_user_statistics(
    user_id, project_id, species_id, songtype_id,
    validated, correct, incorrect, pending,
    confidence,
    last_update
) SELECT
    Q.user_id, Q.project_id, Q.species_id, Q.songtype_id,
    Q.validated, Q.correct, Q.incorrect, Q.pending,
    (Q.correct + 1) / (Q.correct + Q.incorrect + 1),
    NOW()
FROM (
    SELECT PMV.user_id, P.project_id, P.species_id, P.songtype_id,
        COUNT(PMV.validated) as validated,
        SUM(IF(PMV.validated = PMR.consensus_validated, 1, 0)) as correct,
        SUM(IF(PMV.validated != PMR.consensus_validated, 1, 0)) as incorrect,
        SUM(IF(PMV.validated IS NOT NULL AND PMR.consensus_validated IS NULL, 1, 0)) as pending
    FROM pattern_matchings P
    JOIN pattern_matching_rois PMR ON P.pattern_matching_id = PMR.pattern_matching_id
    JOIN pattern_matching_validations PMV ON PMR.pattern_matching_roi_id = PMV.pattern_matching_roi_id
    GROUP BY PMV.user_id, P.project_id, P.species_id, P.songtype_id
) Q
ON DUPLICATE KEY UPDATE
    validated=VALUES(validated), correct=VALUES(correct), incorrect=VALUES(incorrect),
    pending=VALUES(pending),
    confidence=VALUES(confidence),
    last_update=VALUES(last_update)
;
