var debug = require('debug')('arbimon2:route:model');
var express = require('express');
var request = require('request');
var router = express.Router();
var async = require('async');
var util = require('util');
var mysql = require('mysql');
var path = require('path');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();

var model = require('../../model');
var pokeDaMonkey = require('../../utils/monkey');
var scriptsFolder = __dirname+'/../../scripts/';
var config = require('../../config');


// ------------------------ models routes -------------------------------------

router.get('/project/:projectUrl/models', function(req, res, next) {

    model.projects.modelList(req.params.projectUrl, function(err, rows) {
        if(err) return next(err);

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
    var job_id, params;

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

            if(!req.haveAccess(project_id, "manage models and classification"))
                return res.json({ error: "you dont have permission to 'manage models and classification'" });

            name = (req.body.n);
            train_id = mysql.escape(req.body.t);
            classifier_id = mysql.escape(req.body.c);
            usePresentTraining = mysql.escape(req.body.tp);
            useNotPresentTraining = mysql.escape(req.body.tn);
            usePresentValidation = mysql.escape(req.body.vp);
            useNotPresentValidation  = mysql.escape(req.body.vn);
            user_id = req.session.user.id;
            params = {
                name       : name                   ,
                train      : train_id               ,
                classifier : classifier_id          ,
                user       : user_id                ,
                project    : project_id             ,
                upt        : usePresentTraining     ,
                unt        : useNotPresentTraining  ,
                upv        : usePresentValidation   ,
                unv        : useNotPresentValidation
            };

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
        function add_job(next){
            model.jobs.newJob(params, 'training_job', next);
        },
        function get_job_id(_job_id){
            var next = arguments[arguments.length -1];
            job_id = _job_id;
            next();
        },
        function poke_the_monkey(next){
            pokeDaMonkey();
            next();
        },
    ], function(err, data){
        if(err){
            if(!response_already_sent){
                res.json({ err:"Could not create training job"});
            }
            return;
        } else {
            res.json({ ok:"job created trainingJob:"+job_id});
        }
    });


});

router.get('/project/:projectUrl/models/:mid', function(req, res, next) {
    model.models.details(req.params.mid, function(err, model) {
        if(err) {
            if(err.message == "model not found") {
                return res.status(404).json({ error: err.message });
            }
            else {
                return next(err);
            }
        }
        res.json(model);
    });
});

router.post('/project/:projectUrl/models/savethreshold', function(req, res, next) {
    model.models.savethreshold(req.body.m,req.body.t, function(err, row) {
        if(err) return next(err);

        res.json({ok:'saved'});
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

router.get('/project/:projectUrl/models/:modelId/validation-list', function(req, res, next) {

    if(!req.params.modelId)
        return res.json({ error: 'missing values' });

    model.projects.modelValidationUri(req.params.modelId, function(err, row) {
        if(err) return next(err);
        
        if(!row.length) {
            return res.sendStatus(404);
        }
        
        var validationUri = row[0].uri;
        validationUri = validationUri.replace('.csv','_vals.csv');
        s3.getObject({
            Key: validationUri,
            Bucket: config('aws').bucketName
        },
        function(err, data) {
            if(err) {
                if(err.code == 'NoSuchKey') return res.json({ err: "list not found"});
                else return next(err);
            }
            var outData = String(data.Body);

            var lines = outData.split('\n');
            
            lines = lines.filter(function(line) {
                return line !== '';
            });

            async.map(lines, function(line, callback) {
                items = line.split(',');
                var prec = items[1].trim(' ') == 1 ? 'yes' :'no';
                var modelprec = items[2].trim(' ') == 'NA' ? '-' : ( items[2].trim(' ') == 1 ? 'yes' :'no');
                var entryType = items[3] ? items[3].trim(' '):'';
                
                model.recordings.recordingInfoGivenUri(items[0], req.params.projectUrl, function(err, recData) {
                    if(err) {
                        debug("Error fetching recording information: " + items[0]);
                        return callback(err);
                    }
                    
                    if(!recData.length) return callback(new Error('recData not found'));
                    
                    var recUriThumb = recData[0].uri.replace('.wav','.thumbnail.png');
                    recUriThumb = recUriThumb.replace('.flac','.thumbnail.png');

                    var rowSent = {
                        site: recData[0].site,
                        date: recData[0].date,
                        presence: prec,
                        model: modelprec,
                        id: recData[0].id,
                        url: "https://"+ config('aws').bucketName + ".s3.amazonaws.com/" + recUriThumb,
                        type: entryType
                    };

                    callback(null, rowSent);
                });

            },
            function(err, results) { 
                if(err) {
                    return res.json({ err: "Error fetching recording information"});
                }
                debug('sendData2:', results);
                res.json(results);
            });

        });
    });

});

router.get('/project/:projectUrl/models/:modelId/training-vector/:recId', function(req, res, next) {
    if(!req.params.modelId || !req.params.recId) {
        return res.status(400).json({ error: 'missing parameters'});
    }
    
    model.models.getTrainingVector(req.params.modelId, req.params.recId, function(err, result) {
        if(err) return next(err);
        
        console.log('vectorUri', result);
        var vectorUri = result;
        
        s3.getObject({
            Key: vectorUri,
            Bucket: config('aws').bucketName
        },
        function(err, data){
            if(err) {
                if(err.code == 'NoSuchKey'){
                    return res.status(404).json({ err:'vector-not-found' });
                }
                else {
                    return next(err);
                }
            }
            
            async.map(String(data.Body).split(','), function(number, next) {
                next(null, parseFloat(number));
            }, function done(err, vector) {
                console.log(vector.length);
                res.json({ vector: vector });
            });

        });
    });

});

// ---------------------- classifications routes ------------------------------

router.get('/project/:projectUrl/classifications', function(req, res, next) {

    model.projects.classifications(req.params.projectUrl, function(err, rows) {
        if(err) return next(err);

        res.json(rows);
    });
});

router.get('/project/:projectUrl/classification/:cid', function(req, res, next) {
    model.projects.classificationErrorsCount(req.params.projectUrl, req.params.cid, function(err, rowsRecs) {
        if(err) return next(err);
        
        rowsRecs =  rowsRecs[0];

        model.projects.classificationDetail(req.params.projectUrl, req.params.cid, function(err, rows) {
            if(err) return next(err);

            console.log(rows);
            
            var i = 0;
            var data = [];
            var total = [];
            var species =[];
            var songtype =[];
            var th = '';

            while(i < rows.length)
            {
                row = rows[i];
                th = row.th;

                var index = row.species_id + '_' + row.songtype_id;
                if (typeof data[index]  == 'number')
                {
                    data[index] = data[index] + parseInt(row.present);
                    total[index] = total[index] + 1;
                }
                else
                {
                    data[index] = parseInt(row.present);
                    species[index] = row.scientific_name;
                    songtype[index] = row.songtype;
                    total[index] = 1;
                }
                i = i + 1;
            }

            var results = [];

            for (var key in species)
            {
                var per = Math.round( (data[key]/total[key])*100);
                var rr = {
                    err: rowsRecs.count,
                    species: species[key],
                    songtype: songtype[key],
                    total: total[key],
                    data: data[key],
                    percentage: per,
                    th: th
                };
                results.push(rr);
            }
            res.json({"data":results});
        });
    });
});

router.get('/project/:projectUrl/classification/:classiId/more/:from/:total', function(req, res, next) {
    model.projects.classificationDetailMore(req.params.projectUrl, req.params.classiId, req.params.from, req.params.total, function(err, rows) {
        if(err) return next(err);
                
        rows.forEach(function(classiInfo) {
            classiInfo.stats = JSON.parse(classiInfo.json_stats);
            delete classiInfo.json_stats;
            
            classiInfo.rec_image_url = "https://"+ config('aws').bucketName + ".s3.amazonaws.com/"+ classiInfo.uri;
            delete classiInfo.uri;
        });
        
        res.json(rows);
    });
});

router.get('/project/:projectUrl/classification/:cid/delete', function(req, res) {
    model.projects.findByUrl(req.params.projectUrl,
        function(err, rows)
        {
            if(err){ res.json({ err:"Could not delete classification"});  }

            if(!rows.length)
            {
                res.status(404).json({ err: "project not found"});
                return;
            }
            var project_id = rows[0].project_id;

            if(!req.haveAccess(project_id, "manage models and classification"))
                return res.json({ err: "You dont have permission to 'manage models and classification'" });

            model.projects.classificationDelete(mysql.escape(req.params.cid),
                function (err,data)
                {
                    res.json(data);
                }
            );
        }
    );
});

router.post('/project/:projectUrl/classification/new', function(req, res, next) {
    
    var response_already_sent;
    var params, job_id;
    
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
            var project_id = rows[0].project_id;

            if(!req.haveAccess(project_id, "manage models and classification"))
                return res.json({ error: "you dont have permission to 'manage models and classification'" });

            params = {
                name        : req.body.n,
                user        : req.session.user.id,
                project     : project_id,
                classifier  : req.body.c,
                allRecs     : req.body.a, // unused
                sitesString : req.body.s, // unused
                playlist    : req.body.p.id
            };

            next();
        },
        function check_sc_exists(next){
            model.jobs.classificationNameExists({name:params.name,classifier:params.classifier,user:params.user,pid:params.project}, next);
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
        function add_job(next){
            model.jobs.newJob(params, 'classification_job', next);
        },
        function get_job_id(_job_id){
            var next = arguments[arguments.length -1];
            job_id = _job_id;
            next();
        },
        function poke_the_monkey(next){
            pokeDaMonkey();
            next();
        },
    ], function(err, data){
        if(err){
            if(!response_already_sent){
                res.json({ err:"Could not create classification job"});
            }
            return;
        } else {
            res.json({ ok:"job created classification Job:"+job_id});
        }
    });
});

router.get('/project/:projectUrl/classification/:cid/vector/:recId', function(req, res, next) {
    
    if(!req.params.cid || !req.params.recId) {
        return res.status(400).json({ error: 'missing parameters'});
    }
    
    model.projects.classificationVector(req.params.cid, req.params.recId, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) return res.status(404).json({ error: 'data not found'});
        
        var vectorUri = rows[0].vect;
        
        s3.getObject({
            Key: vectorUri,
            Bucket: config('aws').bucketName
        },
        function(err, data){
            if(err) {
                if(err.code == 'NoSuchKey'){
                    return res.status(404).json({ err:'vector-not-found' });
                }
                else {
                    return next(err);
                }
            }
            
            async.map(String(data.Body).split(','), function(number, next) {
                next(null, parseFloat(number));
            }, function done(err, vector) {
                console.log(vector.length);
                res.json({ vector: vector });
            });

        });
    });

});

router.get('/project/classification/csv/:cid', function(req, res) {

    model.projects.classificationName(req.params.cid, function(err, row) {
        if(err) throw err;

        var cname = row[0].name;
        var pid = row[0].pid;
 
        if(!req.haveAccess(pid, "manage models and classification")) {
            return res.send('<html><body><a href="/home" class="navbar-brand">'+
                            '<img src="/images/logo.svg"></a>'+
                            '<hr><div style="font-size:14px;font-family:Helvetica,Arial,sans-serif;">Error: Cannot download CSV file. You dont have permission to \'manage models and classifications\'</div></body>');
        }    

        res.set({
            'Content-Disposition' : 'attachment; filename="'+cname+'.csv"',
            'Content-Type' : 'text/csv'
        });

        model.projects.classificationCsvData(req.params.cid, function(err, row) {
            if(err) throw err;
            var data = [];
            
            var thisrow;
            thisrow = row[0];
            var th = thisrow.threshold;
            
            if(th) {

                data.push('"rec","model presence","threshold presence","current threshold","vector max value","site","year","month","day","hour","minute","species","songtype"');

                for(var i = 0 ; i < row.length ; i++)
                {
                        thisrow = row[i];
                        var maxVal = thisrow.mvv;
                        var tprec = 0;
                        if(maxVal >= th )
                        {
                            tprec = 1;
                        }                     

                        data.push( '"'+ thisrow.rec +'",'+ thisrow.present+','+tprec +','+th+','+maxVal+','+
                           thisrow.name+',' + thisrow.year+',' + thisrow.month+','+
                           thisrow.day+',' + thisrow.hour+','+ thisrow.min+',"' +
                           thisrow.scientific_name+'","'+ thisrow.songtype+'"');
                }
                res.send(data.join("\n"));
                /*
                async.eachLimit(row ,5,
                    function(thisrow,callback)
                    {
                        var maxVal = thisrow['mvv']
                        var tprec = 0;
                           if(maxVal >= th )
                        {
                            tprec = 1;
                        }                     

                        data.push( '"'+ thisrow['rec']+'",'+ thisrow['present']+','+tprec +','+th+','+maxVal+','+
                           thisrow['name']+',' + thisrow['year']+',' + thisrow['month']+','+
                           thisrow['day']+',' + thisrow['hour']+','+ thisrow['min']+',"' +
                           thisrow['scientific_name']+'","'+ thisrow['songtype']+'"');
                      
                        callback();


                    },
                    function(err)
                    {
                        if (err)
                        {
                            res.json({"err": "Error fetching classification information."});
                        }
                        res.send(data.join("\n"));
                    }
                );*/
            }
            else
            {
                data.push('"rec","presence","site","year","month","day","hour","minute","species","songtype"');
                for(var j = 0; j < row.length; j++)
                {
                    thisrow = row[j];
    
                    data.push( '"'+ thisrow.rec+'",'+ thisrow.present+','+
                            thisrow.name+',' + thisrow.year+',' + thisrow.month+','+
                            thisrow.day+',' + thisrow.hour+','+ thisrow.min+',"' +
                            thisrow.scientific_name+'","'+ thisrow.songtype+'"');
                }
                res.send(data.join("\n"));
            }
        });
    });


});

// --------------------- validations routes -----------------------------------

router.get('/project/:projectUrl/validations/:species/:songtype', function(req, res, next) {

    model.projects.validationsStats(req.params.projectUrl,req.params.species,req.params.songtype, function(err, row) {
        if(err) return next(err);

        res.json(row);
    });
});

// ---------------------- jobs routes -----------------------------------------

router.get('/project/:projectUrl/progress', function(req, res, next) {
    model.jobs.activeJobs({url:req.params.projectUrl}, function(err, row) {
        if(err) return next(err);

        res.json(row);
    });
});

router.get('/job/types', function(req, res, next) {
    model.jobs.getJobTypes(function(err, types) {
        if(err){ next(err); return; }
        res.json(types);
    });
});

router.get('/project/:projectUrl/job/hide/:jId', function(req, res) {

    model.jobs.hide(req.params.jId, function(err, rows) {
        if(err) res.json('{ "err" : "Error removing job"}');

        model.jobs.activeJobs(req.params.projectUrl, function(err, row) {
            if(err) return next(err);

            res.json(row);
        });
    });
});

router.get('/project/:projectUrl/job/cancel/:jId', function(req, res) {

    model.jobs.cancel(req.params.jId, function(err, rows) {
        if(err) res.json('{ "err" : "Error removing job"}');

        model.jobs.activeJobs(req.params.projectUrl, function(err, row) {
            if(err) return next(err);

            res.json(row);
        });
    });
});

// --------------------- soundscapes routes

router.post('/project/:projectUrl/soundscape/new', function(req, res, next) {
    var response_already_sent;
    var params, job_id;

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
            var project_id = rows[0].project_id;

            if(!req.haveAccess(project_id, "manage soundscapes")) {
                console.log('user cannot create soundscape');
                response_already_sent = true;
                res.status(403).json({ err: "you dont have permission to 'manage soundscapes'" });
                return next(new Error());
            }
            params = {
                name        : (req.body.n),
                user        : req.session.user.id,
                project     : project_id,
                playlist    : (req.body.p.id),
                aggregation : (req.body.a),
                threshold   : (req.body.t),
                bin         : (req.body.b),
                maxhertz    : (req.body.m),
                frequency   : (req.body.f),
                normalize   : (req.body.nv)
            };

            next();
        },
        function check_sc_exists(next){
            model.jobs.soundscapeNameExists({name:params.name,pid:params.project}, next);
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
        function add_job(next){
            model.jobs.newJob(params, 'soundscape_job', next);
        },
        function get_job_id(_job_id){
            var next = arguments[arguments.length -1];
            job_id = _job_id;
            next();
        },
        function poke_the_monkey(next){
            pokeDaMonkey();
            next();
        }
    ], function(err, job_id){
        if(err){
            if(!response_already_sent){
                res.json({ err:"Could not create soundscape job"});
            }
            return;
        } else {
            res.json({ ok:"job created soundscapeJob:"+job_id });
        }
    });
});


module.exports = router;
