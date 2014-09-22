var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Express' });
});

router.get('/mockup/visualizer', function(req, res) {
  res.render('mockup/visualizer', { title: 'Visualizer' });
});


module.exports = router;
