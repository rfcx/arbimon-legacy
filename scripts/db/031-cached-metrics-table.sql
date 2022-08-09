CREATE TABLE `cached_metrics` (
  `key` VARCHAR(20) NOT NULL,
  `value` INT NOT NULL DEFAULT 0,
  `expires_at` DATETIME NOT NULL,
  PRIMARY KEY (`key`),
  UNIQUE KEY `unique_key` (`key`)
);
