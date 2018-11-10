var debug = require('debug')('arbimon2:route:project');
var express = require('express');
var model = require('../model');
var config = require('../config');
var router = express.Router();

var cardStack = require('./resource-cards');
var cardResolver = require('../utils/card-resolver')(cardStack);

var injected_data = {
    facebook_api: config('facebook-api').public,
    googleAPI : config('google-api'),
    here_maps_api: config('here-maps-api'),
};

// discards rest of path
router.use('/', function(req, res, next){
    var m = /^(\/([^\/]+))\/(.+)$/.exec(req.url);
    if(m){
        req.url = m[1]; 
        req.originalUrl = req.originalUrl.substring(0, req.originalUrl.length - m[3].length);
        var m2 = /(.+)\.card\.json$/.exec(m[3]);
        if(m2){
            m[3] = m2[1];
            req.show_card = true;
        }
        req.inAppUrl =  m[3];
        next('route');
    } else {
        next();
    }
});

router.get('/:projecturl?/', function(req, res, next) {
    res.type('html');
    var project_url = req.params.projecturl;
    var project_id = req.query.id;
    
    if(project_id && !project_url){
        var project;
        return model.projects.find({ id: project_id }).get(0).then(function(_project) {
            project = _project;
            if(project){
                return model.users.getPermissions(req.session.user.id, project.project_id);
            }
            return res.redirect('/home'); 
        }).then(function(rows) {
            if(!project || (project.is_private && !rows.length && req.session.user.isSuper === 0)){
                // if not authorized to see project send 404
                return next();
            } else {
                return res.redirect('/project/' + project.url + '/'); 
            }
        }).catch(next);
    }
    
    debug('project_url:', project_url);
    
    // redirect to home if no project is given
    if(!project_url){
        res.redirect('/home');
        return;
    }
    
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
                    return res.redirect('/home'); 
                }

                if(!req.session.user.permissions)
                    req.session.user.permissions = {};

                req.session.user.permissions[project.project_id] = rows;
                var perms = { 
                    authorized: true,
                    public: !project.is_private,
                    super: !!req.session.user.isSuper,
                    permissions: rows.map(function(perm) { return perm.name; }),
                };

                debug("project perms:", req.session.user.permissions);

                req.project = {
                    id: project.project_id,
                    name: project.name
                };
                
                var appAbsUrl = req.appHost + req.originalUrl;
                cardResolver.getCardFor(project, appAbsUrl, req.inAppUrl).nodeify(function(err, card){
                    if(req.show_card && err){ 
                        next(err);
                    }
                    else if(req.show_card){ 
                        if(card){
                            res.json(card);
                        } else {
                            res.status(404).json({});
                        }
                    } 
                    else {
                        res.render('app', { 
                            env : req.app.get('env'),
                            project: req.project, 
                            url_base: req.originalUrl + (/\//.test(req.originalUrl) ? '' : '/'),
                            user: req.session.user,  
                            // a2HereMapsLoader
                            inject_data : injected_data,
                            card: card,
                            planAlert: project.plan_due < new Date() ? 'expired' : '',
                            perms: perms,
                        });
                    }
                });

            });
        }
    );
});


module.exports = router;
