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

router.get('/:trainingSet/unshare', function(req, res, next) {
    res.type('json');
    return model.trainingSets.unshareTrainingSet({ trainingSetId: req.params.trainingSet })
        .then((data) => {
            res.status(201).json({ message: 'The training set was successfully unshared with the selected project.' })
        })
        .catch(next)
});

router.get('/:trainingSet/shared-list', function(req, res, next) {
    res.type('json');
    return model.trainingSets.find({ id: req.params.trainingSet }, function(err, data) {
        const opts = data[0];
        model.trainingSets.getSharedTrainingSet(opts)
            .then((rows) => {
                res.status(200).json(rows);
            })
            .catch(next)
    })
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

router.post('/share', function(req, res, next) {
    res.type('json');

    const sourceProjectId = req.project.project_id;
    if (!sourceProjectId || !(typeof sourceProjectId === 'number')) {
        return res.status(404).json({ error: 'Source project id is not found.' });
    }
    const opts = {
        projectId: req.body.projectIdTo,
        sourceProjectId: sourceProjectId,
        trainingSetId: req.body.trainingSetId,
        trainingSetName: req.body.trainingSetName,
        species: req.body.species,
        songtype: req.body.songtype
    }
    model.trainingSets.find({ project: opts.projectId, sourceProject: sourceProjectId, name: opts.trainingSetName }, async function(err, result) {
        if (err) return next(err);
        if (result.length) return res.status(400).json({ message: 'This training set is already existed in the project.' });
        model.trainingSets.shareTrainingSet(opts)
            .then(() => {
                res.status(201).json({ message: 'The training set was successfully shared with the selected project.' })
            })
            .catch(next)
    });
});

/** Combine 2 training sets into 1.
 */
router.post('/combine', async function(req, res, next) {
    res.type('json')

    const opts = {
        projectId: req.project.project_id,
        term1: req.body.term1,
        term2: req.body.term2,
        species: req.body.species,
        songtype: req.body.songtype,
        name: req.body.name
    }

    const term1Data = await model.trainingSets.find({ id: opts.term1 })
    if (term1Data.length === 0) {
        return res.status(404).json({ field: 'term1', error: 'Training set not found.'});
    }

    const term2Data = await model.trainingSets.find({ id: opts.term2 })
    if (term2Data.length === 0) {
        return res.status(404).json({ field: 'term2', error: 'Training set not found.'});
    }

    if (!opts.name) {
        opts.name = `${term1Data[0].name} union ${term2Data[0].name}`
    }
    const combinedTrainingSet = await model.trainingSets.find({ name: opts.name, project: opts.projectId})
    if (combinedTrainingSet.length > 0) {
        return res.status(400).json({ error: 'This training set combination already exists.<br>Please select a different combination.'});
    }
    
    model.trainingSets.combine(opts)
    .then(() => {
        res.status(201).json({ message: 'Training set created.' })
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
        return res.status(201).json({ message: 'Training set removed.' })
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
