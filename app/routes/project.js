var debug = require('debug')('arbimon2:route:project');
var express = require('express');
var model = require('../model');
var config = require('../config');
var router = express.Router();

var cardStack = require('./resource-cards');
var cardResolver = require('../utils/card-resolver')(cardStack);
const auth0Service = require('../model/auth0')

var injected_data = {
    facebook_api: config('facebook_api').public,
    googleAPI : config('google_api')
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
    const project_url = req.params.projecturl;
    if(!project_url){
        console.log('\n\n---TEMP: project url undefined')
        res.redirect('/projects');
        return;
    }
    const project_id = req.query.id;
    if(project_id && !project_url){
        var project;
        return model.projects.find({ id: project_id, publicTemplates: true }).get(0).then(function(_project) {
            project = _project;
            if(project){
                return model.users.getPermissions(req.session.user.id, project.project_id);
            }
            return res.redirect('/');
        }).then(function(rows) {
            if(!project || (project.is_private && !rows.length && req.session.user.isSuper === 0)){
                console.log('\n\n---TEMP: /projects 52 string', project, req.session.user)
                // if not authorized to see project send 404
                return next();
            } else {
                return res.redirect('/project/' + project.url + '/');
            }
        }).catch(next);
    }

    model.projects.find({ url: project_url, publicTemplates: true}, async function(err, rows) {
            if (err) return next(err);
            if (!rows.length)  {
                console.log('\n\n---TEMP: /projects 62 string', rows)
                return next(); // handled by 404
            }

            var project = rows[0];
            let userRole
            if (!!req.session.user.isSuper) userRole = 'Admin'
            else if (req.session.user.id) {
                const role = await model.users.getProjectRole(req.session.user.id, project.project_id)
                userRole = role && role.name ? role.name : 'Guest'
            }
            model.users.getPermissions(req.session.user.id, project.project_id, function(err, rows) {
                var permissionsMap = rows.reduce(function(_, p) {
                    _[p.name] = true;
                    return _;
                }, {});

                const isEmptyPath = req._parsedOriginalUrl && (req._parsedOriginalUrl.path === `/project/${project_url}` || req._parsedOriginalUrl.path ===`/project/${project_url}/`);

                if (isEmptyPath && (permissionsMap['view project'] || req.session.user.isSuper)) {
                    return res.redirect(`/p/${project_url}/overview`)
                }

                if (isEmptyPath && (!project.is_private && !permissionsMap['view project'])) {
                    return res.redirect(`/p/${project_url}/insights`)
                }

                if(!project.is_private || permissionsMap['view project'] || req.session.user.isSuper){
                    // pass
                } else if(permissionsMap['use citizen scientist interface']){
                    // Allow the navigation to the Visualizer page for citizen scientist users
                    if (req.inAppUrl && req.inAppUrl.startsWith('visualizer')) {
                        // pass
                    }
                    else {
                        return res.redirect('/citizen-scientist/' + project.url + '/');
                    }
                } else {
                    // if not authorized to see project send 404
                    console.log('\n\n---TEMP: /projects 106 string - not authorized to see project')
                    return res.redirect('/projects')
                }

                if(!req.session.user.permissions)
                    req.session.user.permissions = {};

                req.session.user.permissions[project.project_id] = rows;
                req.session.loggedIn = true
                let perms = {
                    authorized: true,
                    public: !project.is_private,
                    features:{
                        citizen_scientist: !!project.citizen_scientist_enabled,
                        public_templates_enabled: !!project.public_templates_enabled,
                    },
                    super: !!req.session.user.isSuper,
                    isAuthorized: !req.session.isAnonymousGuest,
                    rfcxUser: !!req.session.user && !!req.session.user.email && !!req.session.user.email.includes('rfcx.org'),
                    userEmail: !!req.session.user && !!req.session.user.email ? req.session.user.email : '',
                    userImage: !!req.session.user && !!req.session.user.imageUrl ? req.session.user.imageUrl : '',
                    userFullName: !!req.session.user && !!req.session.user.firstname ? req.session.user.firstname + ' ' + req.session.user.lastname : '',
                    userId: !!req.session.user && !!req.session.user.id ? req.session.user.id : '',
                    permissions: rows.map(function(perm) { return perm.name; }),
                    userRole: userRole ? userRole : 'Guest'
                };

                req.project = {
                    id: project.project_id,
                    name: project.name,
                    external_id: project.external_id
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
                            url_base: req.originalUrl + (/\/$/.test(req.originalUrl) ? '' : '/'),
                            user: req.session.user,
                            // a2GoogleMapsLoader
                            inject_data : injected_data,
                            card: card,
                            perms: perms,
                            auth0UniversalLoginUrl: auth0Service.universalLoginUrl
                        });
                    }
                });

            });
        }
    );
});


module.exports = router;
