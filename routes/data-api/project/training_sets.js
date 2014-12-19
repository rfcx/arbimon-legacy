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

router.param('dataId', function(req, res, next, dataId){
    req.dataId = dataId | 0;
    return next();
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

router.get('/rois/:trainingSet', function(req, res, next) {
    model.training_sets.fetchRois(req.trainingSet,
    function(err, data) {
        if(err) return next(err);

        res.json(data);
        return null;
    });
});

router.get('/data/:trainingSet/get-image/:dataId', function(req, res, next) {
    model.training_sets.fetchDataImage(req.trainingSet, req.dataId, function(err, data) {
        if(err) return next(err);
        res.json(data);
        return null;
    });
});


router.get('/species/:trainingSet', function(req, res, next) {
    model.training_sets.fetchSpecies(req.trainingSet,
    function(err, data) {
        if(err) return next(err);

        res.json(data);
        return null;
    });
});



router.use(function(req, res, next) { 
    if(!req.haveAccess(req.project.project_id, "manage training sets"))
        return res.json({ error: "you dont have permission to 'manage training sets'" });
        
    next();
});


/** Add a training set to a project.
*/
router.post('/add', function(req, res, next) {
    
    model.training_sets.nameInUse(req.project.project_id, req.body.name, function(err, result) {
        if(err) return next(err);
        
        if(result[0].count) {
            return res.json({ field: "name", error: "Training set name in use" });
        }
        
        model.training_sets.insert({
            project_id : req.project.project_id,
            name    : req.body.name,
            type    : req.body.type,
            extras  : req.body
        }, function(err, new_tset) {
            if(err) return next(err);
            
            model.projects.insertNews({
                news_type_id: 7, // training set created
                user_id: req.session.user.id,
                project_id: req.project.project_id,
                data: JSON.stringify({ training_set: req.body.name })
            });
            
            res.json(new_tset && new_tset[0]);
            return null;
        });
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


router.get('/:trainingSet/remove-roi/:roiId', function(req, res, next) {
    model.training_sets.removeRoi(req.params.roiId,req.trainingSet,
    function(err, data) {
        if(err) return next(err);

        res.json(data);
        return null;
    });
});

module.exports = router;
