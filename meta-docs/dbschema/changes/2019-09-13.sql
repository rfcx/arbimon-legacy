ALTER TABLE `arbimon2`.`pattern_matching_rois`
ADD INDEX `pattern_matching_matches_recording_score_idx` (`recording_id` ASC, `score` ASC);
;
