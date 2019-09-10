INSERT INTO `arbimon2`.`permissions` (`permission_id`, `name`, `description`, `security_level`) VALUES (23, 'view citizen scientist expert interface', 'user can view citizen scientist expert interface', '0');
INSERT INTO `arbimon2`.`permissions` (`permission_id`, `name`, `description`, `security_level`) VALUES (24, 'view citizen scientist admin interface', 'user can view citizen scientist admin interface', '0');


INSERT INTO `arbimon2`.`role_permissions` (`role_id`, `permission_id`) VALUES ('1', '23');
INSERT INTO `arbimon2`.`role_permissions` (`role_id`, `permission_id`) VALUES ('6', '23');
INSERT INTO `arbimon2`.`role_permissions` (`role_id`, `permission_id`) VALUES ('1', '24');
