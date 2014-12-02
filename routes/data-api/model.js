var debug = require('debug')('arbimon2:route:model');
var express = require('express');
var router = express.Router();
var model = require('../../models');
var async = require('async');
var util = require('util');
var mysql = require('mysql');
var path = require('path');
var jobQueue = require('../../utils/jobqueue');
var scriptsFolder = __dirname+'/../../scripts/';
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
debug('here mnore')
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
    var response_already_sent;
    var project_id, name, train_id, classifier_id, usePresentTraining;
    var useNotPresentTraining, usePresentValidation, useNotPresentValidation, user_id;
    var trainingId;
    
    async.waterfall([
        function find_project_by_url(next){
            model.projects.findByUrl(req.params.projectUrl, next);
        },
        function gather_job_params(rows){
            var next = arguments[arguments.length-1];
            
            if(!rows.length){
                res.status(404).json({ err: "project not found"});
                response_already_sent = true;
                next(new Error());
                return;
            }
            
            project_id = rows[0].project_id;
            name = (req.body.n);
            train_id = mysql.escape(req.body.t);
            classifier_id = mysql.escape(req.body.c);
            usePresentTraining = mysql.escape(req.body.tp);
            useNotPresentTraining = mysql.escape(req.body.tn);
            usePresentValidation = mysql.escape(req.body.vp);
            useNotPresentValidation  = mysql.escape(req.body.vn);
            user_id = req.session.user.id;
            
            next();
        },
        function check_md_exists(next){
            model.jobs.modelNameExists({name:name,classifier:classifier_id,user:user_id,pid:project_id}, next);
        },
        function abort_if_already_exists(row) {
            var next = arguments[arguments.length-1];
            if(row[0].count !== 0){
                res.json({ name:"repeated"});
                response_already_sent = true;
                next(new Error());
                return;
            } else {
                next();
            }
        },
        function make_new_job(next){
            model.jobs.newJob({name:name,train:train_id,classifier:classifier_id,user:user_id,pid:project_id},1, next);
        },
        function make_new_training_job(row){
            debug(__dirname+'/../../.env/bin/python',scriptsFolder+'training.py',row.insertId , name);
            var next = arguments[arguments.length-1];
            trainingId = row.insertId;
            model.jobs.newTrainingJob({
                id:trainingId,name:name,
                train:train_id,classifier:classifier_id,
                user:user_id,pid:project_id,upt:usePresentTraining,
                unt:useNotPresentTraining,upv:usePresentValidation,
                unv:useNotPresentValidation
            }, next);
        },
        function push_job_to_queue(row){
            var next = arguments[arguments.length-1];
            jobQueue.push({
                name: 'trainingJob'+trainingId,
                work: function(callback){
                    var python = require('child_process').spawn(
                        __dirname+'/../../.env/bin/python', [
                            scriptsFolder+'PatternMatching/training.py',
                            trainingId, 
                            name
                        ]
                    );
                    var output = "";
                    python.stdout.on('data', function(data) { 
                        output += data;
                        debug(output);
                    });
                    python.on('close', function(code) { 
                        if (code !== 0) { 
                            debug('trainingJob returned error ',trainingId);
                        } else {
                            debug('no error, everything ok, trainingJob completed ',trainingId);
                        }
                        callback(code);
                    });
                }
            },
            1, // priority
            function(data) {
                debug("job done! trainingJob", trainingId,data);                
                model.training_sets.findName(train_id, function(err, rows) {
                    model.projects.insertNews({
                        news_type_id: 8, // model created and trained
                        user_id: req.session.user.id,
                        project_id: project_id,
                        data: JSON.stringify({ model: name, training_set: rows[0].name })
                    });
                });
            });
            next();
        }
    ], function(err, data){
        if(err){
            if(!response_already_sent){
                res.json({ err:"Could not create training job"});
            }
            return;
        } else {
            res.json({ ok:"job created trainingJob:"+trainingId});
        }
    });


});

router.post('/project/:projectUrl/classification/new', function(req, res, next) {
    var response_already_sent;
    var project_id, name, classifier_id, playlist_id, user_id, allRecs, sitesString;
    var classificationId;
    async.waterfall([
        function find_project_by_url(next){
            model.projects.findByUrl(req.params.projectUrl, next);
        }, 
        function gather_job_params(rows){
            var next = arguments[arguments.length-1];
            
            if(!rows.length){
                res.status(404).json({ err: "project not found"});
                response_already_sent = true;
                next(new Error());
                return;
            }
            
            project_id = rows[0].project_id;
            name = (req.body.n);
            classifier_id = mysql.escape(req.body.c);
            playlist_id = (req.body.p.id);
            user_id = req.session.user.id;
            allRecs = mysql.escape(req.body.a);
            sitesString = mysql.escape(req.body.s);
            
            next();
        },
        function check_c_exists(next){
            model.jobs.classificationNameExists({name:name,classifier:classifier_id,user:user_id,pid:project_id}, next);
        },
        function abort_if_already_exists(row) {
            var next = arguments[arguments.length-1];
            if(row[0].count !== 0){
                res.json({ name:"repeated"});
                response_already_sent = true;
                next(new Error());
                return;
            } else {
                next();
            }
        },
        function make_new_job(row) {
            var next = arguments[arguments.length-1];
            model.jobs.newJob({name:name,classifier:classifier_id,user:user_id,pid:project_id},2, next);
        },
        function (row){
            var next = arguments[arguments.length-1];
            classificationId = row.insertId;
            model.jobs.newClassificationJob({id:classificationId,name:name,classifier:classifier_id,user:user_id,pid:project_id,playlist_id:playlist_id}, next);
        },
        function(row){
            var next = arguments[arguments.length-1];
            debug(
                __dirname+'/../../.env/bin/python',
                scriptsFolder+'PatternMatching/classification.py',
                classificationId , name , allRecs, 
                sitesString, classifier_id, project_id,user_id, playlist_id
            );
            
            jobQueue.push(
                {   name: 'classificationJob'+classificationId,
                    work: function(callback){
                        var python = require('child_process').spawn(
                            __dirname+'/../../.env/bin/python', [
                            scriptsFolder+'PatternMatching/classification.py' ,
                                classificationId , name , allRecs, 
                                sitesString, classifier_id, project_id,user_id,playlist_id
                            ]
                        );
                        var output = "";
                        python.stdout.on('data', function(data){ 
                            output += data;
                        });
                        python.on('close', function(code) { 
                            if (code !== 0) { 
                                debug('classificationJob returned error',classificationId);
                            } else {
                                debug('no error, everything ok, classificationJob completed',classificationId);
                            }
                            callback();
                        });
                    }
                }, 1, function() {
                debug("job done! classificationJob", classificationId);
                
                model.models.findName(classifier_id, function(err, rows) {
                    model.projects.insertNews({
                        news_type_id: 9, // model created and trained
                        user_id: req.session.user.id,
                        project_id: project_id,
                        data: JSON.stringify({ model: rows[0].name, classi: name })
                    });
                });
            });
            next();
        }
    ], function(err, data){
        if(err){
            if(!response_already_sent){
                res.json({ err:"Could not create classification job"}); 
            }
            return;
        } else {
            res.json({ ok:"job created classificationJob:"+classificationId});           
        }
    });
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
        validationUri = validationUri.replace('.csv','_vals.csv')
        var aws = require('knox').createClient({
            key: config.accessKeyId
          , secret: config.secretAccessKey
          , bucket: config.bucketName
        });
        var sendData = [];
        
console.log(validationUri)
        aws.getFile(validationUri, function(err, resp){
            
            if (err) {
                debug("Error fetching validation information file. : "+validationUri)
                res.json({"err": "Error fetching validation information."});
            }
            
            if (resp.statusCode == 404)
            {
                return res.json({"nofile": "nofile"});
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
                        var prec = items[1].trim(' ') == 1 ? 'yes' :'no';
                        var modelprec = items[2].trim(' ') == 1 ? 'yes' :'no';
                        model.recordings.recordingInfoGivenUri(items[0],req.params.projectUrl,
                        function(err,recData)
                        {
                            if (err) {
                                debug("Error fetching recording information. : "+items[0])
                                res.json({"err": "Error fetching recording information."});
                                callback('err')
                            }
                            if (recData.length > 0)
                            {
                                var rowSent = {site:recData[0].site,date:recData[0].date,presence:prec,model:modelprec,id:recData[0].id};
                                sendData.push(rowSent)
                            }
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
                    debug('sendData2: '+sendData)
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
    debug('req.params.projectUrl : '+req.params.projectUrl)
    var response_already_sent;
    var project_id,name,user_id,aggregation;
    var threshold,playlist_id,bin,maxhertz,frequency;
    var soundscapeId;

    async.waterfall([
        function find_project_by_url(next){
            model.projects.findByUrl(req.params.projectUrl, next);
        },
        function gather_job_params(rows){
            var next = arguments[arguments.length -1];            
            if(!rows.length){
                res.status(404).json({ err: "project not found"});
                response_already_sent = true;
                next(new Error());
                return;
            }
            
            project_id  = rows[0].project_id;
            name        = (req.body.n);
            user_id     = req.session.user.id;
            aggregation = (req.body.a);
            threshold   = (req.body.t); 
            playlist_id = (req.body.p.id);
            bin         = (req.body.b);
            maxhertz    = (req.body.m);
            frequency   = (req.body.f);
            
            next();
        },
        function check_sc_exists(next){
            model.jobs.soundscapeNameExists({name:name,pid:project_id}, next);
        },
        function abort_if_already_exists(row) {
            var next = arguments[arguments.length -1];            
            if(row[0].count !== 0){
                res.json({ name:"repeated"});
                response_already_sent = true;
                next(new Error());
                return;
            }
            
            next();
        },
        function make_new_job(next){            
            model.jobs.newJob({name:name,user:user_id,pid:project_id}, 4, next);
        },
        function make_new_sc_job(row){
            var next = arguments[arguments.length -1];
            soundscapeId = row.insertId;
            
            model.jobs.newSoundscapeJob({
                id:soundscapeId,name:name,playlist:playlist_id,
                aggregation:aggregation,threshold:threshold,
                bin:bin,maxhertz:maxhertz,frequency:frequency
            }, next);
        },
        function push_job_to_queue(row){
            var next = arguments[arguments.length -1];
            jobQueue.push({
                name: 'soundscapeJob'+soundscapeId,
                work: function(callback){
                    var python = require('child_process').spawn(
                        __dirname+'/../../.env/bin/python',
                        [
                            scriptsFolder+'Soundscapes/playlist2soundscape.py' ,
                            mysql.escape(soundscapeId),mysql.escape(playlist_id),
                            mysql.escape(maxhertz),mysql.escape(bin),mysql.escape(aggregation),
                            mysql.escape(threshold),mysql.escape(project_id),mysql.escape(user_id),
                            mysql.escape(name),mysql.escape(frequency)
                        ]
                    );
                    var output = "";
                    python.stdout.on('data', function(data){ 
                        output += data
                    });
                    python.on('close', function(code){ 
                        if (code !== 0) { 
                            debug('soundscapeJob '+soundscapeId+' returned error ' + code);
                        } else {
                            debug('no error, everything ok, soundscapeJob completed ',soundscapeId);
                        }
                        callback();
                    });
                }
            },
            1,
            function() {
                debug("job done! soundscapeJob:", soundscapeId);
                model.projects.insertNews({
                    news_type_id: 11, // soundscape created
                    user_id: req.session.user.id,
                    project_id: project_id,
                    data: JSON.stringify({ soundscape: name })
                });
            });
            next();
        }
    ], function(err, data){
        if(err){
            if(!response_already_sent){
                res.json({ err:"Could not create soundscape job"});
            }            
            return;
        } else {
            res.json({ ok:"job created soundscapeJob:"+soundscapeId });
        }
    })
});

module.exports = router;
