/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();

router.use('/pattern-matchings', require('./pattern-matchings'));
router.use('/stats', require('./stats'));
router.use('/settings', require('./settings'));


module.exports = router;
