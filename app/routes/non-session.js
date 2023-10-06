var express = require('express');
var router = express.Router();

router.use('/legacy-api/ingest', require('./data-api/ingest'));
router.use('/legacy-api/integration', require('./data-api/integration'));

module.exports = router;
