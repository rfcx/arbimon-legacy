/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();
var model = require('../../../model');
var csv_stringify = require("csv-stringify");


router.param('trainingSet', function(req, res, next, trainingSet){
    model.trainingSets.find({ id: trainingSet }, function(err, trainingSets) {
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
    res.type('json');
    model.trainingSets.find({ project:req.project.project_id }, function(err, count) {
        if(err) return next(err);

        res.json(count);
        return null;
    });
});

/** Return a list of all the training set types in a project (actually in the system).
 */
router.get('/types', function(req, res, next) {
    res.type('json');
    model.trainingSets.getTypes(function(err, types) {
        if(err) return next(err);

        res.json(types);
        return null;
    });
});


/** Return a training set's data.
 */
router.get('/list/:trainingSet/:recUrl?', function(req, res, next) {
    res.type('json');
    model.trainingSets.fetchData(req.trainingSet, {
        recording: req.params.recUrl
    }, function(err, count) {
        if(err) return next(err);

        res.json(count);
    });
});

router.get('/rois/:trainingSet', function(req, res, next) {
    if(!!req.query.export){
        res.attachment(req.trainingSet.name + '.csv');
        model.trainingSets.fetchRois(req.trainingSet, {resolveIds:true, noURI:true, stream:true}, function(err, datastream, fields) {
            if(err){
                next(err);
            } else {
                fields = fields.map(function(f){return f.name;});
                datastream
                    .pipe(csv_stringify({
                        header:true, 
                        columns:fields
                    }))
                    .pipe(res);
            }
        });
    } else {
        res.type('json');
        model.trainingSets.fetchRois(req.trainingSet, function(err, data) {
            if(err) return next(err);

            res.json(data);
        });
    }
});

router.get('/data/:trainingSet/get-image/:dataId', function(req, res, next) {
    res.type('json');
    model.trainingSets.fetchDataImage(req.trainingSet, req.dataId, function(err, data) {
        if(err) return next(err);
        res.json(data);
    });
});


router.get('/species/:trainingSet', function(req, res, next) {
    res.type('json');
    model.trainingSets.fetchSpecies(req.trainingSet, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length){
            return res.sendStatus(404);
        }

        res.json(rows[0]);
    });
});



router.use(function(req, res, next) { 
    res.type('json');
    if(!req.haveAccess(req.project.project_id, "manage training sets"))
        return res.json({ error: "you dont have permission to 'manage training sets'" });
        
    next();
});


/** Add a training set to a project.
*/
router.post('/add', function(req, res, next) {
    res.type('json');
    
    model.trainingSets.nameInUse(req.project.project_id, req.body.name).then(function(isInUse) {
        if(isInUse) {
            return res.json({ field: "name", error: "Training set name in use" });
        }
        
        model.trainingSets.insert({
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
    }, next);
});

/** Combine 2 training sets into 1.
 */
router.post('/combine', async function(req, res, next) {
    res.type('json')

    const opts = {
        projectId: req.project.project_id,
        term1: req.body.term1,
        term2: req.body.term2
    }

    const term1Data = await model.trainingSets.find({ id: opts.term1 })
    if (term1Data.length == 0) {
        res.status(404).json({ field: 'term1', error: 'training set not found'});
    }

    const term2Data = await model.trainingSets.find({ id: opts.term2 })
    if (term2Data.length == 0) {
        res.status(404).json({ field: 'term2', error: 'training set not found'});
    }

    opts.name = `${term1Data.name} union ${term2Data.name}`
    const combinedTrainingSet = await model.trainingSets.find({ name: opts.name, project: opts.projectId})
    if (combinedTrainingSet.length > 0) {
        res.status(400).json({ error: 'term1 and term2 combination is existing'});
    }
    
    model.trainingSets.combine(opts)
    .then(() => {
        res.status(201).json({ message: 'training set created' })
    })
    .catch(next)
})

/** Edit a training set.
*/
router.post('/edit/:trainingSet', function(req, res, next) {
    res.contentType('application/json');
    model.trainingSets.edit(req.trainingSet, {
        name    : req.body.name,
        extras  : req.body
    }).then(function(edited_tset) {
        model.projects.insertNews({
            news_type_id: 12, // training set created
            user_id: req.session.user.id,
            project_id: req.project.project_id,
            data: JSON.stringify({ training_set: req.trainingSet.name })
        });
        
        res.json(edited_tset && edited_tset[0]);
        return null;
    }, next);
});

/** Remove a training set.
*/
router.post('/remove/:trainingSet', function(req, res, next) {
    res.type('json');
    model.trainingSets.remove(req.trainingSet).then(function() {
        model.projects.insertNews({
            news_type_id: 13, // training set created
            user_id: req.session.user.id,
            project_id: req.project.project_id,
            data: JSON.stringify({ training_set: req.trainingSet.name })
        });
        
        res.json(req.trainingSet);
        return null;
    }, next);
});


/** Add a training set to a project.
*/
router.post('/add-data/:trainingSet', function(req, res, next) {
    res.type('json');
    model.trainingSets.addData(req.trainingSet, req.body, function(err, tset_data) {
        if(err) return next(err);
        return res.json(tset_data);
    });
});


router.get('/:trainingSet/remove-roi/:roiId', function(req, res, next) {
    res.type('json');
    model.trainingSets.removeRoi(req.params.roiId,req.trainingSet,
    function(err, data) {
        if(err) return next(err);

        res.json(data);
        return null;
    });
});

module.exports = router;
