var express = require('express');
var router = express.Router();
var model = require('../../../models');


router.param('trainingSet', function(req, res, next, training_set){
    model.training_sets.find({
        name    : training_set,
        project : req.project.project_id
    }, function(err, count) {
        if(err) return next(err);
            
        res.json(count);
        return null;
    });
});


/** Return a list of all the training sets in a project.
 */
router.get('/', function(req, res, next) {
    model.training_sets.find({project:req.project.project_id}, function(err, count) {
        if(err) return next(err);
            
        res.json(count);
        return null;
    });
});


/** Return a list of all the training sets in a project.
 */
router.post('/add', function(req, res, next) {
    model.training_sets.insert({
        project : req.project.project_id,
        name    : req.body.name,
        type    : 1 /* TODO: un hard-code this */
    }, function(err, new_tset) {
        if(err) return next(err);
            
        res.json(new_tset);
        return null;
    });
});

/** Return a training set's data.
 */
router.get('/list/:trainingSet/:recUrl?', function(req, res, next) {
    res.json(req.trainingSet);
});



module.exports = router;