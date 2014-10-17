var express = require('express');
var router = express.Router();
var model = require('../../../models');


router.param('trainingSet', function(req, res, next, training_set){
    model.training_sets.find({
        name    : training_set,
        project : req.project.project_id
    }, function(err, trainingSets) {
        if(err) return next(err);

        if(!trainingSets.length){
            return res.status(404).json({ error: "training set not found"});
        }
        req.trainingSet = trainingSets[0];
        return next();
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

/** Return a list of all the training set types in a project (actually in the system).
 */
router.get('/types', function(req, res, next) {
    model.training_sets.getTypes(function(err, types) {
        if(err) return next(err);

        res.json(types);
        return null;
    });
});


/** Add a training set to a project.
 */
router.post('/add', function(req, res, next) {
    model.training_sets.insert({
        project : req.project.project_id,
        name    : req.body.name,
        type    : req.body.type,
        extras  : req.body
    }, function(err, new_tset) {
        if(err) return next(err);

        res.json(new_tset && new_tset[0]);
        return null;
    });
});


/** Add a training set to a project.
 */
router.post('/add-data/:trainingSet', function(req, res, next) {
    model.training_sets.addData(req.trainingSet, req.body, function(err, tset_data) {
        if(err) return next(err);
        return res.json(tset_data);
    });
});

/** Return a training set's data.
 */
router.get('/list/:trainingSet/:recUrl?', function(req, res, next) {
    model.training_sets.fetchData(req.trainingSet, {
        recording: req.param('recUrl')
    }, function(err, count) {
        if(err) return next(err);

        res.json(count);
        return null;
    });
});



module.exports = router;
