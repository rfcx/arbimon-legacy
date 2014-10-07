var express = require('express');
var model = require('../models');
var router = express.Router();

router.get('/', function(req, res) 
{
    res.redirect('/home');
});

router.param('project', function(req, res, next, project) 
{
    console.log('hola');
    model.projects.findByUrl(project ,
        function(err,rows)
        {   
            if(err) return next(err);
            
            if(!rows.length) return res.redirect('/home');
            
            var project = rows[0];
            
            if(project.is_enabled)
            {
                model.users.getPermissions(req.session.user.id, project.project_id, function(err, rows) {
                    
                    if(project.is_private && !rows.length)
                        return res.redirect('/home');
                    
                    if(!req.session.user.permissions)
                        req.session.user.permissions = {};
                    
                    req.session.user.permissions[project.project_id] = rows;
                    
                    //~ console.dir(req.session.user.permissions);
                    
                    req.project = {
                        id: project.project_id,
                        name: project.name
                    };
                    return next();
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

router.get('/:project?/', function(req, res) 
{
    res.render('app/index', { project: req.project, user: req.session.user });
});


module.exports = router;
