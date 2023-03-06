var express = require('express');
var router = express.Router();

router.use('/api/ingest', require('./data-api/ingest'));
router.use('/api/integration', require('./data-api/integration'));

module.exports = router;
