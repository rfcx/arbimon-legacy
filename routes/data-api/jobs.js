var express = require('express');
var router = express.Router();
var model = require('../../model');

// job types
router.get('/types', function(req, res, next) {
    model.jobs.getJobTypes(function(err, types) {
        if(err){ next(err); return; }
        res.json(types);
    });
});

module.exports = router;
