UPDATE `arbimon2`.`permissions`
SET description = 'user can view and edit project sites'
WHERE permission_id = 6;

INSERT INTO `arbimon2`.`permissions` (name, description, security_level)
VALUES ('delete site', 'user can delete a site', 0);


INSERT INTO `arbimon2`.`role_permissions` (role_id, permission_id)
VALUES
    (1, 26),
    (4, 26),
    (6, 26),
    (2, 6);
