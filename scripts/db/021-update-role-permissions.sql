INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, permission_id
FROM role_permissions
WHERE role_id = 7;

UPDATE user_project_role
SET role_id = 3
WHERE role_id = 7;

DELETE FROM role_permissions
WHERE role_id=2 AND permission_id not in (1, 7, 8, 10);

INSERT INTO role_permissions (role_id, permission_id)
VALUES (2, 20);

DELETE FROM role_permissions
WHERE role_id=6 AND permission_id IN (12, 14);

INSERT INTO role_permissions (role_id, permission_id)
VALUES (6, 20);

DELETE FROM role_permissions
WHERE role_id=5 AND permission_id not in (1, 7, 9);

INSERT INTO role_permissions (role_id, permission_id)
VALUES (5, 20);

DELETE FROM role_permissions
WHERE role_id=1 AND permission_id not in (1, 24, 23, 6, 7, 8, 9, 10, 13, 15, 16, 17, 18, 21, 19, 20, 12, 22, 5);

INSERT INTO role_permissions (role_id, permission_id)
VALUES (1, 20);

DELETE FROM role_permissions
WHERE role_id=4 AND permission_id not in (1, 24, 23, 6, 7, 8, 9, 10, 13, 15, 16, 17, 18, 21, 19, 20, 12, 22, 5, 2);

DELETE FROM roles
WHERE role_id=7;
