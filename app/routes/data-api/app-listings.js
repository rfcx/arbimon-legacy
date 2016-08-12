var debug = require('debug')('arbimon2:route:apps');
var router = require('express').Router();
var models = require('../../model');

router.get('/:appname?', function(req, res, next){
    models.AppListings.getListFor(req.params.appname).then(function(appList){
        res.json(appList);
    }).catch(next);
});

module.exports = router;
