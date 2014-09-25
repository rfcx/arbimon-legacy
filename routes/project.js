var express = require('express');
var router = express.Router();


router.get('/', function(req, res) 
{
 	res.send('no project selected');
});

router.param('project', function(req, res, next, project) {
	// do validation on name here
	// blah blah validation
	// log something so we know its working
	console.log('doing name validations on ' + project);

	// once validation is done save the new item in the req
	req.project = project;
	// go to the next thing
	next();	
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
