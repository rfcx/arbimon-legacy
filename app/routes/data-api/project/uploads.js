var debug = require('debug')('arbimon2:route:uploads');
var router = require('express').Router();

var model = require('../../../model');

router.get('/processing', function(req, res, next) {
    model.uploads.getUploadsList({
        project: req.project.project_id,
        count: true,
        refs:true,
        limit: Math.min(req.query.limit|0 || 50, 50),
        offset: Math.max(req.query.offset|0, 0),
    }).then(function(uploads){
        res.json(uploads);
    }, next);
});


module.exports = router;
