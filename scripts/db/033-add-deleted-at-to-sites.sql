ALTER TABLE `arbimon2`.`sites`
ADD COLUMN `deleted_at` DATETIME DEFAULT NULL;

CREATE INDEX deleted_at ON sites(deleted_at);
