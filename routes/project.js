var debug = require('debug')('arbimon2:route:project');
var express = require('express');
var model = require('../model');
var router = express.Router();

// discards rest of path
router.use('/', function(req, res, next){
    var m = /(\/([^\/]+))\/(.+)/.exec(req.url);
    if(m){
        req.originalUrl = req.originalUrl.substring(0, req.originalUrl.length - m[3].length);
        req.url = m[1];
        next('route');
    } else {
        next();
    }
});

router.get('/:projecturl?/', function(req, res, next) {
    var project_url = req.params.projecturl;

    debug('project_url:', project_url);
    
    model.projects.find({ url: project_url }, function(err, rows) {
            if(err) return next(err);
            
            if(!rows.length) return next(); // handled by 404

            var project = rows[0];

            if(!project.is_enabled) {
                return res.render('project_disabled', { project: project });
            }
            
            
            if(project.plan_period && project.plan_activated) {
                project.plan_due = new Date(project.plan_activated);
                project.plan_due.setFullYear(project.plan_due.getFullYear() + project.plan_period);
            }
            
            model.users.getPermissions(req.session.user.id, project.project_id, function(err, rows) {

                if(project.is_private && !rows.length && req.session.user.isSuper === 0) {
                    // if not authorized to see project send 404
                    return next(); 
                }

                if(!req.session.user.permissions)
                    req.session.user.permissions = {};

                req.session.user.permissions[project.project_id] = rows;

                debug("project perms:", req.session.user.permissions);

                req.project = {
                    id: project.project_id,
                    name: project.name
                };

                // return next();
                return res.render('app', { 
                    project: req.project, 
                    url_base: req.originalUrl + (/\//.test(req.originalUrl) ? '' : '/'),
                    user: req.session.user,  
                    planAlert: project.plan_due < new Date() ? 'expired' : ''
                });

            });
        }
    );
});


module.exports = router;
