var express = require('express');
var model = require('../models');
var router = express.Router();


router.get('/', function(req, res) 
{
 	res.send('no project selected');
});

router.param('project', function(req, res, next, project) 
{
	model.projects.isValidUrl(project ,
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
					req.project = project;
					if(rows[0].is_enabled>0)
					{
						next();
					}
					else
					{
						res.send('your project '+project+' has been disabled. please pay');
					}	
				}
				else 
				{
					res.send('project does not exists '+project);
				}
			}
		}
	);	
});

router.get('/:project/', function(req, res) 
{
  	res.send('DASHBOARD project '+req.project);
});


router.get('/:project/data', function(req, res) 
{
  	res.send('audio data in project '+req.project);
});

router.get('/:project/models', function(req, res) 
{
  	res.send('models in project '+req.project);
});

router.get('/:project/classify', function(req, res) 
{
  	res.send('classify in project '+req.project);
});

router.get('/:project/visualize', function(req, res) 
{
  	res.send('visuzlizer in models project '+req.project);
});

module.exports = router;
