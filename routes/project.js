var express = require('express');
var model = require('../models');
var router = express.Router();

router.get('/', function(req, res) 
{
	res.send('<html><head><title>Select project</title></head><body>No project selected</body></html>');
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
					
					if(rows[0].is_enabled>0)
					{
						req.id = rows[0].project_id;
						req.name = rows[0].name;
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

router.get('/:project*', function(req, res) 
{
  	res.render('app/index', { title:req.name , id:req.id });
});

module.exports = router;
