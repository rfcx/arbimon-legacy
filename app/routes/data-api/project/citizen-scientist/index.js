/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();


// global project.citizen_scientist_enabled check
router.use(function(req, res, next) {
    if(!req.project.citizen_scientist_enabled) {
        return res.status(401).json({ error: "Citizen scientist features are not enabled for your." });
    }

    next();
});


router.use('/pattern-matchings', require('./pattern-matchings'));
router.use('/stats', require('./stats'));
router.use('/settings', require('./settings'));


module.exports = router;
