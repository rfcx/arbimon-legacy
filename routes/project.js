var debug = require('debug')('arbimon2:route:project');
var express = require('express');
var model = require('../model');
var router = express.Router();


router.get('/:projecturl?/', function(req, res, next)
{
    var project_url = req.param('projecturl');

    debug('project_url', project_url);
    
    model.projects.findByUrl(project_url ,
        function(err,rows) {
            if(err) return next(err);

            if(!rows.length) return next();

            var project = rows[0];

            if(project.is_enabled){
                model.users.getPermissions(req.session.user.id, project.project_id, function(err, rows) {

                    if(project.is_private && !rows.length && req.session.user.isSuper === 0)
                        return res.redirect('/home');

                    if(!req.session.user.permissions)
                        req.session.user.permissions = {};

                    req.session.user.permissions[project.project_id] = rows;

                    debug("project perms:", req.session.user.permissions);

                    req.project = {
                        id: project.project_id,
                        name: project.name
                    };

                    // return next();
                    return res.render('app', { project: req.project, user: req.session.user });

                });
            } else {
                return res.render('project_disabled', { project: project});
            }
        }
    );
});


module.exports = router;
