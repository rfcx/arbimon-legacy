/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:route:project:classifications');
var express = require('express');
var async = require('async');
var AWS = require('aws-sdk');

var config = require('../../../config');
var model = require('../../../model');
var pokeDaMonkey = require('../../../utils/monkey');

var router = express.Router();
var s3 = new AWS.S3();


router.get('/', function(req, res, next) {
    model.classifications.list(req.project.project_id, function(err, rows) {
        if(err) return next(err);

        res.json(rows);
    });
});

router.get('/:classiId', function(req, res, next) {
    model.classifications.errorsCount(req.params.classiId, function(err, rowsRecs) {
        if(err) return next(err);
        
        rowsRecs =  rowsRecs[0];

        model.classifications.detail(req.params.classiId, function(err, rows) {
            if(err) return next(err);

            var i = 0;
            var data = [];
            var total = [];
            var species =[];
            var songtype =[];
            var th = '';

            while(i < rows.length)
            {
                var row = rows[i];
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

router.get('/:classiId/more/:from/:total', function(req, res, next) {
    model.classifications.moreDetails(req.params.classiId, req.params.from, req.params.total, function(err, rows) {
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

router.get('/:classiId/delete', function(req, res) {
    if(!req.haveAccess(req.project.project_id, "manage models and classification")) {
        return res.json({
            err: "You dont have permission to 'manage models and classification'"
        });
    }

    model.classifications.delete(req.params.classiId, function(err, data) {
        res.json(data);
    });
});

router.post('/new', function(req, res, next) {
    var response_already_sent;
    var params, job_id;
    
    async.waterfall([
        function gather_job_params(next){
            var project_id = req.project.project_id;

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
            model.jobs.classificationNameExists({
                name: params.name,
                classifier: params.classifier,
                user: params.user,
                pid: params.project
            }, next);
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

router.get('/:classiId/vector/:recId', function(req, res, next) {
    
    if(!req.params.classiId || !req.params.recId) {
        return res.status(400).json({ error: 'missing parameters'});
    }
    
    model.classifications.getRecVector(req.params.classiId, req.params.recId, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) { 
            return res.status(404).json({ error: 'data not found'});
        }
        
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
                res.json({ vector: vector });
            });

        });
    });

});

router.get('/project/csv/:classiId', function(req, res) {

    model.classifications.getName(req.params.classiId, function(err, row) {
        if(err) throw err;

        var cname = row[0].name;
        var pid = row[0].pid;
 
        if(!req.haveAccess(pid, "manage models and classification")) {
            // TODO use std error message json, presentation is a frontend task
            return res.send('<html><body><a href="/home" class="navbar-brand">'+
                            '<img src="/images/logo.svg"></a>'+
                            '<hr><div style="font-size:14px;font-family:Helvetica,Arial,sans-serif;">Error: Cannot download CSV file. You dont have permission to \'manage models and classifications\'</div></body>');
        }    

        res.set({
            'Content-Disposition' : 'attachment; filename="'+cname+'.csv"',
            'Content-Type' : 'text/csv'
        });

        model.classifications.getCsvData(req.params.classiId, function(err, row) {
            if(err) throw err;
            var data = [];
            
            var thisrow;
            thisrow = row[0];
            var th = thisrow.threshold;
            
            if(th) {
                var fields = [
                    "rec",
                    "model presence",
                    "threshold presence",
                    "current threshold",
                    "vector max value",
                    "site",
                    "year",
                    "month",
                    "day",
                    "hour",
                    "minute",
                    "species",
                    "songtype"
                ];
                
                data.push(fields.join(','));

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

module.exports = router;
