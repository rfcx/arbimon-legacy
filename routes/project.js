var express = require('express');
var router = express.Router();


router.get('/', function(req, res) 
{
 	res.send('DASHBOARD no project selected');
});

router.get('/:url/', function(req, res) 
{
  	res.send('DASHBOARD project '+req.params.url);
});

router.get('/:url/data', function(req, res) 
{
  	res.send('audio data in project '+req.params.url);
});

router.get('/:url/models', function(req, res) 
{
  	res.send('models in project '+req.params.url);
});

router.get('/:url/classify', function(req, res) 
{
  	res.send('classify in project '+req.params.url);
});

router.get('/:url/visualize', function(req, res) 
{
  	res.send('visuzlizer in models project '+req.params.url);
});

module.exports = router;
