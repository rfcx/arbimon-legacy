var express = require('express');
var router = express.Router();
var model = require('../../models');
var async = require('async');
var util = require('util');
var mysql = require('mysql');
var path = require('path');
var jobQueue = require('../../utils/jobqueue');
var scriptsFolder = __dirname+'/../../scripts/'
var config = require('../../config/aws.json');


router.get('/project/:projectUrl/models', function(req, res, next) {

    model.projects.modelList(req.params.projectUrl, function(err, rows) {
        if(err) return next(err);

        res.json(rows);
    });
});

router.get('/project/:projectUrl/classifications', function(req, res, next) {

    model.projects.classifications(req.params.projectUrl, function(err, rows) {
        if(err) return next(err);

        res.json(rows);
    });
});

router.get('/project/:projectUrl/classification/:cid', function(req, res, next) {
    model.projects.classificationErrors(req.params.projectUrl,req.params.cid , function(err, rowsRecs) {
        if(err) res.json({"data":[]});
        rowsRecs =  rowsRecs[0]
        model.projects.classificationDetail(req.params.projectUrl,req.params.cid, function(err, rows) {
            if(err) res.json({"data":[]});
            
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
                var rr = {"err":rowsRecs['count'],"species":species[key],"songtype":songtype[key],"total":total[key],"data":data[key],"percentage":per }
                results.push(rr);
            }
            res.json({"data":results});
        })
    });
});

router.get('/project/:projectUrl/classification/:cid/more/:f/:t', function(req, res) {
console.log('here mnore')
    model.projects.classificationDetailMore(req.params.projectUrl,req.params.cid,req.params.f,req.params.t, function(err, rows) {
        if(err) throw err;
        res.json(rows);
    });
});

router.get('/project/:projectUrl/models/forminfo', function(req, res, next) {

    model.models.types( function(err, row1) {
        if(err) return next(err);
        model.projects.trainingSets( req.params.projectUrl, function(err, row2) {
            if(err) return next(err);
                res.json({ types:row1 , trainings:row2});
        });

    });
});

router.post('/project/:projectUrl/models/new', function(req, res, next) {

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
            model.jobs.modelNameExists({name:name,classifier:classifier_id,user:user_id,pid:project_id},
            
                function(err,row) {
                    if(err)
                    {
                       res.json({ err:"Could not create job"}); 
                    }
                    else if(row[0].count==0){            
            
                        model.jobs.newJob({name:name,train:train_id,classifier:classifier_id,user:user_id,pid:project_id},1,
                            function (err,row)
                            {console.log(__dirname+'/../../.env/bin/python',scriptsFolder+'training.py'
                                                            ,row.insertId , name)
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
                                            { 
                                                jobQueue.push({
                                                    name: 'trainingJob'+trainingId,
                                                    work: function(callback)
                                                    {
                                                        var python = require('child_process').spawn
                                                        (
                                                            __dirname+'/../../.env/bin/python',
                                                            [scriptsFolder+'PatternMatching/training.py'
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
                                                                if (code !== 0) { console.log('trainingJob returned error ',trainingId)}
                                                                else console.log('no error, everything ok, trainingJob completed ',trainingId);
                                                                callback(code);
                                                            }
                                                        );
                                                    }
                                                },
                                                1, // priority
                                                function(data) {
                                                    console.log("job done! trainingJob", trainingId,data);
                                                    
                                                    model.training_sets.findName(train_id, function(err, rows) {
                                                        model.projects.insertNews({
                                                            news_type_id: 8, // model created and trained
                                                            user_id: req.session.user.id,
                                                            project_id: project_id,
                                                            data: JSON.stringify({ model: name, training_set: rows[0].name })
                                                        });
                                                    });
                                                });
                                                res.json({ ok:"job created trainingJob:"+trainingId});           
                                            }
                                        }
                                    );
                                }
                            }
                        );
                    }else res.json({ name:"repeated"});
                }
            );
        }
    );

});

router.post('/project/:projectUrl/classification/new', function(req, res, next) {
    
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
            var playlist_id = (req.body.p.id)
            var user_id = req.session.user.id;
            var allRecs = mysql.escape(req.body.a);
            var sitesString = mysql.escape(req.body.s);
            model.jobs.classificationNameExists({name:name,classifier:classifier_id,user:user_id,pid:project_id},
            
                function(err,row) {
                    if(err)
                    {
                       res.json({ err:"Could not create job"}); 
                    }
                    else if(row[0].count==0){
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
                                    model.jobs.newClassificationJob({id:classificationId,name:name,classifier:classifier_id,user:user_id,pid:project_id,playlist_id:playlist_id},
                                        function (err,row)
                                        {
                                            if(err)
                                            {
                                               res.json({ err:"Could not create classification job"}); 
                                            }
                                            else
                                            {
                                                console.log(
                                                    __dirname+'/../../.env/bin/python',
                                                            scriptsFolder+'PatternMatching/classification.py'
                                                            ,classificationId , name , allRecs, sitesString, classifier_id, project_id,user_id,playlist_id
                                                    
                                                )
                                                jobQueue.push({
                                                    name: 'classificationJob'+classificationId,
                                                    work: function(callback)
                                                    {
                                                        var python = require('child_process').spawn
                                                        (
                                                            __dirname+'/../../.env/bin/python',
                                                            [scriptsFolder+'PatternMatching/classification.py'
                                                            ,classificationId , name , allRecs, sitesString, classifier_id, project_id,user_id,playlist_id]
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
                                                                if (code !== 0) { console.log('classificationJob returned error',classificationId)}
                                                                else console.log('no error, everything ok, classificationJob completed',classificationId);
                                                                callback();
                                                            }
                                                        );
                                                    }
                                                },
                                                1,
                                                function() {
                                                    console.log("job done! classificationJob", classificationId);
                                                    
                                                    model.models.findName(classifier_id, function(err, rows) {
                                                        model.projects.insertNews({
                                                            news_type_id: 9, // model created and trained
                                                            user_id: req.session.user.id,
                                                            project_id: project_id,
                                                            data: JSON.stringify({ model: rows[0].name, classi: name })
                                                        });
                                                    });
                                                });
                                                
                                                res.json({ ok:"job created classificationJob:"+classificationId});           
                                            }
                                        }
                                    );
                                }
                            }
                        );  
                    }else res.json({ name:"repeated"});
                }
            );
        }
    );
});

router.get('/project/:projectUrl/models/:mid', function(req, res, next) {

    model.models.details(req.params.mid, function(err, row) {
        if(err) return next(err);   
        res.json(row);
    });
});

router.get('/project/:projectUrl/models/:mid/delete', function(req, res, next) {
    model.projects.findByUrl(req.params.projectUrl, 
        function(err, rows) 
        {
            if(err) return next(err);
            
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
                    if(err) return next(err);
                    var rows = "Deleted model";
                    res.json(rows);
                }
            );
        }
    );
});

router.get('/project/:projectUrl/validation/list/:modelId', function(req, res, next) {

    model.projects.modelValidationUri(req.params.modelId, function(err, row) {
        if(err) return next(err);
        var validationUri = row[0].uri        
        var aws = require('knox').createClient({
            key: config.accessKeyId
          , secret: config.secretAccessKey
          , bucket: config.bucketName
        });
        var sendData = [];
        aws.getFile(validationUri, function(err, resp){
            if (err) {
                console.log("Error fetching validation information file. : "+validationUri)
                res.json({"err": "Error fetching validation information."});
            }
            var outData = ''
            resp.on('data', function(chunk) { outData = outData + chunk; });
            resp.on('end',
            function(chunk)
            {
                outData = outData
                var lines = outData.split('\n')
                async.eachLimit(lines ,5,
                function(line,callback)
                {
                    if (line == '')
                    {
                        callback()
                    }
                    else
                    {
                        
                        items = line.split(',');
                        prec = items[3].trim(' ')
                        model.recordings.recordingInfoGivenUri(items[0],
                        function(err,recData)
                        {
                            if (err) {
                                console.log("Error fetching recording information. : "+items[0])
                                res.json({"err": "Error fetching recording information."});
                                callback('err')
                            }
                            var rowSent = {presence:prec,site:recData[0].site,date:recData[0].date,id:recData[0].id};
                            sendData.push(rowSent)
                            callback()
                        });
                        
                    }
                },
                function(err)
                {
                    if (err)
                    {
                        res.json({"err": "Error fetching recording information."});
                    }
                    console.log('sendData2: '+sendData)
                    res.json(sendData);
                }
                );
                
            });
        });
        
     });
});


router.get('/project/:projectUrl/validations/:species/:songtype', function(req, res, next) {

    model.projects.validationsStats(req.params.projectUrl,req.params.species,req.params.songtype, function(err, row) {
        if(err) return next(err);

        res.json(row);
    });
});

router.get('/project/:projectUrl/progress', function(req, res, next) {

    model.projects.activeJobs(req.params.projectUrl, function(err, row) {
        if(err) return next(err);

        res.json(row);
    });
});

router.get('/project/:projectUrl/progress/queue', function(req, res) {

    var string = "(running:"+jobQueue.running() +
                 ") (idle: "+jobQueue.idle()+
                 ") (concurrency: "+ jobQueue.concurrency+
                 ") (started: "+ jobQueue.started+
                 ") (howmanyInqueue: "+ jobQueue.length()+
                 ") (isPaused: "+ jobQueue.paused+")"
                 
    res.json({"debug":string});

});

router.get('/project/:projectUrl/job/hide/:jId', function(req, res) {

    model.jobs.hide(req.params.jId, function(err, rows) {
        if(err) res.json('{ "err" : "Error removing job"}');

        model.projects.activeJobs(req.params.projectUrl, function(err, row) {
            if(err) return next(err);
    
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
    
router.get('/project/classification/csv/:cid', function(req, res) {

    model.projects.classificationName(req.params.cid, function(err, row) {
        if(err) throw err;
        var cname = row[0]['name'];
        res.set({
            'Content-Disposition' : 'attachment; filename="'+cname+'.csv"',
            'Content-Type' : 'text/csv'
        });
        
        model.projects.classificationCsvData(req.params.cid, function(err, row) {
            if(err) throw err;
            var data = '"rec","presence","site","year","month","day","hour","minute","species","songtype"\n';
            var thisrow;
            for(var i =0;i < row.length;i++)
            {
                thisrow = row[i]
                data = data + '"'+ thisrow['rec']+'",'+ thisrow['present']+','+
                        thisrow['name']+',' + thisrow['year']+',' + thisrow['month']+','+
                        thisrow['day']+',' + thisrow['hour']+','+ thisrow['min']+',"' +
                        thisrow['scientific_name']+'","'+ thisrow['songtype']+'"\n'
            }
            res.send(data);
        });
    });
          

});


router.post('/project/:projectUrl/soundscape/new', function(req, res, next) {
    console.log('req.params.projectUrl : '+req.params.projectUrl)
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
            var user_id = req.session.user.id;
            var aggregation =  (req.body.a);
            var threshold =  (req.body.t); 
            var playlist_id = (req.body.p.id);
            var bin = (req.body.b);
            var maxhertz = (req.body.m);
            var frequency = (req.body.f);
            model.jobs.soundscapeNameExists({name:name,pid:project_id},
            
                function(err,row) {
                    if(err)
                    {
                       res.json({ err:"Could not create job"}); 
                    }
                    else if(row[0].count==0)
                    {
                        
                        model.jobs.newJob({name:name,user:user_id,pid:project_id},4,
                            function (err,row)
                            {
                                if(err)
                                {
                                   res.json({ err:"Could not create job"}); 
                                }
                                else
                                {
                                    var soundscapeId = row.insertId;

                                    model.jobs.newSoundscapeJob({id:soundscapeId,name:name,playlist:playlist_id,
                                                                aggregation:aggregation,threshold:threshold,
                                                                bin:bin,maxhertz:maxhertz,frequency:frequency},
                                        function (err,row)
                                        {
                                            if(err)
                                            {
                                               res.json({ err:"Could not create soundscape job"}); 
                                            }
                                            else
                                            {
                                                jobQueue.push({
                                                    name: 'soundscapeJob'+soundscapeId,
                                                    work: function(callback)
                                                    {
                                                        var python = require('child_process').spawn
                                                        (
                                                            __dirname+'/../../.env/bin/python',
                                                            [scriptsFolder+'Soundscapes/playlist2soundscape.py'
                                                             ,mysql.escape(soundscapeId),mysql.escape(playlist_id),
                                                            mysql.escape(maxhertz),mysql.escape(bin),mysql.escape(aggregation)
                                                            ,mysql.escape(threshold),mysql.escape(project_id),mysql.escape(user_id)
                                                            ,mysql.escape(name),mysql.escape(frequency)]
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
                                                                if (code !== 0) { console.log('soundscapeJob returned error ',soundscapeId)}
                                                                else console.log('no error, everything ok, soundscapeJob completed ',soundscapeId);
                                                                callback();
                                                            }
                                                        );
                                                    }
                                                },
                                                1,
                                                function() {
                                                    console.log("job done! soundscapeJob:", soundscapeId);
                                                    /*
                                                    model.models.findName(classifier_id, function(err, rows) {
                                                        model.projects.insertNews({
                                                            news_type_id: 9, // model created and trained
                                                            user_id: req.session.user.id,
                                                            project_id: project_id,
                                                            data: JSON.stringify({ model: rows[0].name, classi: name })
                                                        });
                                                    });
                                                    */
                                                });
                                                res.json({ ok:"job created soundscapeJob:"+soundscapeId });           
                                            }
                                        }
                                    );
                                }
                            }
                        );  
                    }
                    else res.json({ name:"repeated"});
                }
            );
        }
    );
});

module.exports = router;
