var express = require('express');
var model = require('../models');
var router = express.Router();

// router.get('/', function(req, res)
// {
//     res.redirect('/home');
// });

router.get('/:projecturl?/', function(req, res, next)
{
    var project_url = req.param('projecturl');

    console.log(project_url);
    model.projects.findByUrl(project_url ,
        function(err,rows)
        {
            if(err) return next(err);

            if(!rows.length) return next();

            var project = rows[0];

            if(project.is_enabled)
            {
                model.users.getPermissions(req.session.user.id, project.project_id, function(err, rows) {

                    if(project.is_private && !rows.length)
                        return res.redirect('/home');

                    if(!req.session.user.permissions)
                        req.session.user.permissions = {};

                    req.session.user.permissions[project.project_id] = rows;

                    console.log("project perms:", req.session.user.permissions);

                    req.project = {
                        id: project.project_id,
                        name: project.name
                    };

                    // return next();
                    return res.render('app/index', { project: req.project, user: req.session.user });
;
                });
            }
            else
            {
                res.send('<html><head><title>Project '+project+' is disabled</title></head><body>Your project '+project
                    +' has been disabled.</body></html>');
            }
        }
    );
});


module.exports = router;
