ALTER TABLE `arbimon2`.`recordings`
ADD COLUMN `datetime_local` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX datetime_local_idx ON recordings(datetime_local);

CREATE INDEX recordings_site_datetime_local_idx ON recordings(site_id, datetime_local);
