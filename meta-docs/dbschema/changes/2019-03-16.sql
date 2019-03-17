INSERT INTO `arbimon2`.`permissions`
    (`permission_id`, `name`, `description`, `security_level`)
VALUES
    (17, 'manage templates', 'user can create templates', '0'),
    (18, 'manage pattern matchings', 'user can create pattern matchings', '0'),
    (19, 'validate pattern matchings', 'user can validate matches in a pattern matching', '0')
;

INSERT INTO `arbimon2`.`role_permissions`
    (`role_id`, `permission_id`)
VALUES
    -- '1', 'Admin', 'Project Administrator - can do anything but delete the project', '', '2'
    (1, 17), -- 'manage templates'
    (1, 18), -- 'manage pattern matchings'
    (1, 19), -- 'validate pattern matchings'
    -- '2', 'User', 'Normal user - can do anything except manage settings, billing or delete the project', '', '4'
    (2, 17), -- 'manage templates'
    (2, 18), -- 'manage pattern matchings'
    (2, 19), -- 'validate pattern matchings'
    -- '3', 'Guest ', 'Guest user - can only view the project', '', '6'
    -- (3, 17), -- 'manage templates'
    -- (3, 18), -- 'manage pattern matchings'
    -- (3, 19), -- 'validate pattern matchings'
    -- '4', 'Owner', 'Project Owner - can do anything on the project', '', '1'
    (4, 17), -- 'manage templates'
    (4, 18), -- 'manage pattern matchings'
    (4, 19), -- 'validate pattern matchings'
    -- '5', 'Data Entry', 'Data Entry user - can manage project data but can only view the analysis section', '', '5'
    (5, 17), -- 'manage templates'
    -- (5, 18), -- 'manage pattern matchings'
    (5, 19), -- 'validate pattern matchings'
    -- '6', 'Expert', 'Expert User - can do anything a user can do plus can invalidate species from recordings', '', '3'
    (6, 17), -- 'manage templates'
    (6, 18), -- 'manage pattern matchings'
    (6, 19) -- 'validate pattern matchings'
;

INSERT INTO `job_types`
    (`job_type_id`,`name`,`identifier`,`description`,`enabled`,`script`,`run_type`)
VALUES
    (6,'Pattern Matching','pattern-matching','Matching of template roi on recordings on a playlist',1,'PatternMatching/pattern_matching.py','script')
;
