var express = require('express');
var router = express.Router();
var model = require('../../models');
var async = require('async');
var util = require('util');
var mysql = require('mysql');
var path = require('path');
var jobQueue = require('../../utils/jobqueue');
var scriptsFolder = __dirname+'/../../scripts/PatternMatching/'
var config = require('../../config/aws.json');


router.get('/project/:projectUrl/models', function(req, res) {

    model.projects.modelList(req.params.projectUrl, function(err, rows) {
        if(err) throw err;

        res.json(rows);
    });
});

router.get('/project/:projectUrl/classifications', function(req, res) {

    model.projects.classifications(req.params.projectUrl, function(err, rows) {
        if(err) throw err;

        res.json(rows);
    });
});

router.get('/project/:projectUrl/classification/:cid', function(req, res) {

    model.projects.classificationDetail(req.params.projectUrl,req.params.cid, function(err, rows) {
        if(err) throw err;
        i = 0
        var data = []
        var total = []
        var species =[]
        var songtype =[]
        while(i < rows.length)
        {
            row = rows[i]
            var index = row['species_id']+'_'+row['songtype_id'];
            if (typeof data[index]  == 'number')
            {
                data[index] = data[index] + parseInt(row['present'])
                total[index] = total[index] + 1
            }
            else
            {
                data[index] = parseInt(row['present'])
                species[index] = row['scientific_name']
                songtype[index] = row['songtype']
                total[index] = 1
            }
            i = i + 1
        }
        var results = []
        for (var key in species)
        {
            var per = Math.round( (data[key]/total[key])*100);
            var rr = {"species":species[key],"songtype":songtype[key],"total":total[key],"data":data[key],"percentage":per }
            results.push(rr);
        }
        res.json({"data":results});
    });
});

router.get('/project/:projectUrl/classification/:cid/more/:f/:t', function(req, res) {
console.log('here mnore')
    model.projects.classificationDetailMore(req.params.projectUrl,req.params.cid,req.params.f,req.params.t, function(err, rows) {
        if(err) throw err;
        res.json(rows);
    });
});

router.get('/project/:projectUrl/models/forminfo', function(req, res) {

    model.models.types( function(err, row1) {
        if(err) throw err;
        model.projects.trainingSets( req.params.projectUrl, function(err, row2) {
            if(err) throw err;
                res.json({ types:row1 , trainings:row2});
        });

    });
});

router.post('/project/:projectUrl/models/new', function(req, res) {

    model.projects.findByUrl(req.params.projectUrl, 
        function(err, rows) 
        {
            if(err){ res.json({ err:"Could not create job"});  }
            
            if(!rows.length)
            {
                res.status(404).json({ err: "project not found"});
                return;
            }
            var project_id = rows[0].project_id;
            var name = (req.body.n);
            var train_id = mysql.escape(req.body.t);
            var classifier_id = mysql.escape(req.body.c);
            var usePresentTraining = mysql.escape(req.body.tp);
            var useNotPresentTraining = mysql.escape(req.body.tn);
            var usePresentValidation = mysql.escape(req.body.vp);
            var useNotPresentValidation  = mysql.escape(req.body.vn);
            var user_id = req.session.user.id;
            model.jobs.newJob({name:name,train:train_id,classifier:classifier_id,user:user_id,pid:project_id},1,
                function (err,row)
                {
                    if(err)
                    {
                       res.json({ err:"Could not create job"}); 
                    }
                    else
                    {
                        var trainingId = row.insertId;
                        model.jobs.newTrainingJob({id:trainingId,name:name,train:train_id,classifier:classifier_id,user:user_id,pid:project_id,upt:usePresentTraining,unt:useNotPresentTraining,upv:usePresentValidation,unv:useNotPresentValidation},
                            function (err,row)
                            {
                                if(err)
                                {
                                   res.json({ err:"Could not create training job"}); 
                                }
                                else
                                { console.log(scriptsFolder)
                                    jobQueue.push({
                                        name: 'training'+trainingId,
                                        work: function(callback)
                                        {
                                            var python = require('child_process').spawn
                                            (
                                                'python',
                                                [scriptsFolder+'training.py'
                                                ,trainingId , name]
                                            );
                                            var output = "";
                                            python.stdout.on('data', 
                                                function(data)
                                                { 
                                                    output += data
                                                    console.log(output)
                                                }
                                            );
                                            python.on('close',
                                                function(code)
                                                { 
                                                    if (code !== 0) { console.log('returned error')}
                                                    else console.log('no error, everything ok, training completed');
                                                    callback();
                                                }
                                            );
                                        }
                                    },
                                    1, // priority
                                    function() {
                                        console.log("job done! training", trainingId);
                                    });
                                    res.json({ ok:"job created :"+trainingId});           
                                }
                            }
                        );
                    }
                }
            );  
        }
    );

});

router.post('/project/:projectUrl/classification/new', function(req, res) {
    
    model.projects.findByUrl(req.params.projectUrl, 
        function(err, rows) 
        {
            if(err){ res.json({ err:"Could not create job"});  }
            
            if(!rows.length)
            {
                res.status(404).json({ err: "project not found"});
                return;
            }
            var project_id = rows[0].project_id;
            var name = (req.body.n);
            var classifier_id = mysql.escape(req.body.c)
            var user_id = req.session.user.id;
            var allRecs = mysql.escape(req.body.a);
            var sitesString = mysql.escape(req.body.s);
            model.jobs.newJob({name:name,classifier:classifier_id,user:user_id,pid:project_id},2,
                function (err,row)
                {
                    if(err)
                    {
                       res.json({ err:"Could not create job"}); 
                    }
                    else
                    {
                        var classificationId = row.insertId;
                        model.jobs.newClassificationJob({id:classificationId,name:name,classifier:classifier_id,user:user_id,pid:project_id},
                            function (err,row)
                            {
                                if(err)
                                {
                                   res.json({ err:"Could not create classification job"}); 
                                }
                                else
                                {
                                    jobQueue.push({
                                        name: 'classification'+classificationId,
                                        work: function()
                                        {
                                            var python = require('child_process').spawn
                                            (
                                                'python',
                                                [scriptsFolder+'classification.py'
                                                ,classificationId , name , allRecs, sitesString, classifier_id, project_id,user_id]
                                            );
                                            var output = "";
                                            python.stdout.on('data', 
                                                function(data)
                                                { 
                                                    output += data
                                                }
                                            );
                                            python.on('close',
                                                function(code)
                                                { 
                                                    if (code !== 0) { console.log('classification returned error')}
                                                    else console.log('no error, everything ok, classification completed');
                                                }
                                            );
                                        }
                                    },
                                    1,
                                    function() {
                                        console.log("job done! classification", classificationId);
                                    });
                                    
                                    res.json({ ok:"job created :"+classificationId});           
                                }
                            }
                        );
                    }
                }
            );  
        }
    );
});

router.get('/project/:projectUrl/models/:mid', function(req, res) {

    model.models.details(req.params.mid, function(err, row) {
        if(err) throw err;        
        res.json(row);
    });
});

router.get('/project/:projectUrl/models/:mid/delete', function(req, res) {
    model.projects.findByUrl(req.params.projectUrl, 
        function(err, rows) 
        {
            if(err){ next(err); return; }
            
            if(!rows.length){
                res.status(404).json({ error: "project not found"});
                return;
            }
            
            var project_id = rows[0].project_id;

            if(!req.haveAccess(project_id, "manage models and classification")) {
                return res.json({ error: "you dont have permission to 'manage models and classification'" });
            }
          
            model.models.delete(req.params.mid, 
                function(err, row) 
                {
                    if(err) throw err;
                    var rows = "Deleted model";
                    res.json(rows);
                }
            );
        }
    );
});

router.get('/project/:projectUrl/validations/:species/:songtype', function(req, res) {

    model.projects.validationsStats(req.params.projectUrl,req.params.species,req.params.songtype, function(err, row) {
        if(err) throw err;

        res.json(row);
    });
});

router.get('/project/:projectUrl/progress', function(req, res) {

    model.projects.activeJobs(req.params.projectUrl, function(err, row) {
        if(err) throw err;

        res.json(row);
    });
});

router.get('/project/:projectUrl/job/hide/:jId', function(req, res) {

    model.jobs.hide(req.params.jId, function(err, rows) {
        if(err) res.json('{ "err" : "Error removing job"}');

        model.projects.activeJobs(req.params.projectUrl, function(err, row) {
            if(err) throw err;
    
            res.json(row);
        });
    });
});

router.post('/project/:projectUrl/classification/vector', function(req, res) {

    var aws = require('knox').createClient({
        key: config.accessKeyId
      , secret: config.secretAccessKey
      , bucket: config.bucketName
    });

    aws.getFile('/'+req.body.v, function(err, resp){
        var outData = ''
        resp.on('data', function(chunk) { outData = outData + chunk; });
        resp.on('end', function(chunk) { res.json({"data":outData}); });
    });

});

module.exports = router;
