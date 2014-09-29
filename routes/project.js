var express = require('express');
var model = require('../models');
var router = express.Router();

router.get('/', function(req, res) 
{
    res.redirect('/home');
});

router.param('project', function(req, res, next, project) 
{
    model.projects.findByUrl(project ,
        function(err,rows)
        {   
            if(err)
            {   
                console.log(err);
            }
            else
            {
                if(rows.length >0)
                {
                    
                    if(rows[0].is_enabled>0)
                    {
                        req.project = {
                            id: rows[0].project_id,
                            name: rows[0].name
                        };
                        next();
                    }
                    else
                    {
                        res.send('<html><head><title>Project '+project+' is disabled</title></head><body>Your project '+project
                            +' has been disabled. Please pay</body></html>');
                    }   
                }
                else 
                {
                    res.send('<html><head><title>Project '+project+' does not exists</title></head><body>The project '+project
                        +' does not exists. Please check  your project url.</body></html>');
                }
            }
        }
    );  
});

router.get('/:project/*', function(req, res) 
{
    res.render('app/index', { project: req.project, user: req.session.user });
});

module.exports = router;
