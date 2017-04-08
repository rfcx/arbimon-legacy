var express = require('express');
var router = express.Router();
var model = require('../../model');

router.get('/published', function(req, res, next) {
    res.type('json');
    model.sites.listPublished(function(err, rows) {
        if(err) return next(err);
        
        res.json(rows);
    });
});

module.exports = router;
