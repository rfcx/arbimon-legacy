var express = require('express');
var router = express.Router();
var model = require('../models');
var async = require('async');
var util = require('util');
var mysql = require('mysql');
var path = require('path');
var jobQueue = require('../utils/jobqueue');
var scriptsFolder = __dirname+'/../scripts/PatternMatching/'

router.get('/user/projectlist', function(req, res, next) {
    model.users.projectList(req.session.user.id, function(err, rows) {
        if(err) return next(err);
        
        res.json(rows);
    });
});

router.get('/user/feed', function(req, res) {
    res.status(200).end();
});

router.post('/project/create', function(req, res, next) {
    var project = req.body.project;
    project.owner_id = req.session.user.id;
    project.project_type_id = 1;
    
    async.parallel({   // check if there any conflict
        nameExists: function(callback) {
            model.projects.findByName(project.name, function(err, rows) {
                if(err) return next(err);
                
                if(!rows.length)
                    callback(null, false);
                else
                    callback(null, true);
            });
        },
        urlExists: function(callback) {
            model.projects.findByUrl(project.url, function(err, rows) {
                if(err) return next(err);
                
                if(!rows.length)
                    callback(null, false);
                else
                    callback(null, true);
            });
        }
    },
    function(err, results) {
        
        if(results.nameExists || results.urlExists) {
            // respond with error
            results.error = true;
            return res.json(results);
        }
        
        // no error create new project
        model.projects.insert(project, function(err, rows) {
            if(err) return next(err);
            
            var project_id = rows.insertId;
            
            model.projects.addUser({
                user_id: project.owner_id,
                project_id: project_id,
                role_id: 4 // owner role id
            },
            function(err, rows) {
                if(err) next(err);
                
                model.projects.insertNews({ 
                    news_type_id: 1, // project created
                    user_id: project.owner_id,
                    project_id: project_id,
                    description: util.format("Project '%s' created by %s", project.name, req.session.user.username)
                });
                res.json({ message: util.format("Project '%s' successfully created!", project.name) });
            });
        });
    });
});

router.get('/project/:projectUrl/info', function(req, res, next) {
    var project_url  = req.param('projectUrl');
    
    model.projects.findByUrl(project_url, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) 
            return res.status(404).json({ error: "project not found"});
            
        res.json(rows[0]);
    });
});

 /**
 * Return a list of all the sites in a project.
 */
router.get('/project/:projectUrl/sites', function(req, res, next) {
    var project_url  = req.param('projectUrl');
    model.projects.findByUrl(project_url, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) 
            return res.status(404).json({ error: "project not found"});
        
        var project_id = rows[0].project_id;
            
        model.projects.getProjectSites(project_id, function(err, rows) {
            if(err) return next(err);
                
            res.json(rows);
            return null;
        });
        return null;
    });
    
});

router.post('/project/create/site', function(req, res, next) {
    var project = req.body.project;
    var site = req.body.site;
        
    if(!req.haveAccess(project.project_id, "manage project sites")) {
        return res.json({ error: "you dont have permission to 'manage project sites'" });
    }
    
    model.sites.exists(site.name, project.project_id, function(err, exists) {
        if(err) return next(err);
        
        if(exists)
            return res.json({ error: 'site with same name already exists'});
        
        site.project_id = project.project_id;
        
        model.sites.insert(site, function(err, rows) {
            if(err) return next(err);
            
            model.projects.insertNews({ 
                news_type_id: 1, // project created
                user_id: req.session.user.id,
                project_id: project.project_id,
                description: util.format("Site '%s' created by %s", site.name, req.session.user.username)
            });
            
            res.json({ message: "New site created" });
        });
    });
});

router.post('/project/update/site', function(req, res, next) {
    var project = req.body.project;
    var site = req.body.site;
    
    if(!req.haveAccess(project.project_id, "manage project sites")) {
        return res.json({ error: "you dont have permission to 'manage project sites'" });
    }
            
    site.project_id = project.project_id;
        
    model.sites.update(site, function(err, rows) {
        if(err) return next(err);
        
        model.projects.insertNews({ 
            news_type_id: 1, // project created
            user_id: req.session.user.id,
            project_id: project.project_id,
            description: util.format("Site '%s' update by %s", site.name, req.session.user.username)
        });
        
        res.json({ message: "site updated" });
    });
});

router.post('/project/delete/sites', function(req, res, next) {
    var project = req.body.project;
    var sites = req.body.sites;
    
    if(!req.haveAccess(project.project_id, "manage project sites")) {
        return res.json({ error: "you dont have permission to 'manage project sites'" });
    }
    
    var sitesIds = $scope.checked.map(function(site) {
        return site.id;
    });
    
    var sitesNames = $scope.checked.map(function(site) {
        return site.name;
    }).join(', ');
        
    model.sites.remove(sitesIds, function(err, rows) {
        if(err) return next(err);
        
        model.projects.insertNews({ 
            news_type_id: 1, // project created
            user_id: req.session.user.id,
            project_id: project.project_id,
            description: util.format("Sites '%s' deleted by %s", sitesNames, req.session.user.username)
        });
        
        res.json(rows);
    });
});

/**
 * Return a list of all the sites in a project.
 */
router.get('/project/:projectUrl/recordings/count/:recUrl?', function(req, res, next) {
    var project_url   = req.param('projectUrl');
    var recording_url = req.param('recUrl');
    model.projects.findByUrl(project_url, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) 
            return res.status(404).json({ error: "project not found"});
        
        var project_id = rows[0].project_id;
            
        model.recordings.findByUrlMatch(recording_url, project_id, {count_only:true}, function(err, count) {
            if(err) return next(err);
                
            res.json(count);
            return null;
        });
        return null;
    });
});

router.get('/project/:projectUrl/recordings/available/:recUrl?', function(req, res, next) {
    var project_url   = req.param('projectUrl');
    var recording_url = req.param('recUrl');
    model.projects.findByUrl(project_url, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) 
            return res.status(404).json({ error: "project not found"});
        
        var project_id = rows[0].project_id;
            
        model.recordings.findByUrlMatch(recording_url, project_id, {count_only:true, group_by:'next', collapse_single_leaves:true}, function(err, count) {
            if(err) return next(err);
                
            res.json(count);
            return null;
        });
        return null;
    });
});

router.get('/project/:projectUrl/recordings/:recUrl?', function(req, res, next) {
    var project_url   = req.param('projectUrl');
    var recording_url = req.param('recUrl');
    model.projects.findByUrl(project_url, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) 
            return res.status(404).json({ error: "project not found"});
        
        var project_id = rows[0].project_id;

        model.recordings.findByUrlMatch(recording_url, project_id, {order:true}, function(err, rows) {
            if(err) return next(err);
                
            res.json(rows);
            return null;
        });
        return null;
    });
    
});


router.get('/project/:projectUrl/recordings/:get/:recUrl?', function(req, res, next) {
    var project_url   = req.param('projectUrl');
    var recording_url = req.param('recUrl');
    var get           = req.param('get');
    model.projects.findByUrl(project_url, function(err, rows) {
        if(err){ next(err); return; }
        
        if(!rows.length){
            res.status(404).json({ error: "project not found"});
            return;
        }
        
        var project_id = rows[0].project_id;
            
        model.recordings.findByUrlMatch(recording_url, project_id, {limit:1}, function(err, recordings) {
            if(err){ next(err); return; }
            var recording = recordings[0];
            var and_return = {
                recording : function(err, recordings){
                    if(err){ next(err); return; }
                    res.json(recordings ? recordings[0] : null);
                },
                file : function(err, file){
                    if(err || !file){ next(err); return; }
                    res.sendFile(file.path);
                },
            };
            switch(get){
                case 'info'  :
                    var url_comps = /(.*)\/([^/]+)\/([^/]+)/.exec(req.originalUrl);
                    recording.audioUrl = url_comps[1] + "/audio/" + recording.id;
                    recording.imageUrl = url_comps[1] + "/image/" + recording.id;
                    model.recordings.fetchInfo(recording, function(err, recording){
                        if(err){ next(err); return;}
                        model.recordings.fetchValidations(recording, function(err, validations){
                            if(err){ next(err); return;}
                            recording.validations = validations;
                            res.json(recording);
                        })
                    });
                break;
                case 'audio' : model.recordings.fetchAudioFile(recording, and_return.file); break;
                case 'image' : model.recordings.fetchSpectrogramFile(recording, and_return.file); break;
                case 'thumbnail'   : model.recordings.fetchThumbnailFile(recording, and_return.file); break;
                case 'next'        : model.recordings.fetchNext(recording, and_return.recording); break;
                case 'previous'    : model.recordings.fetchPrevious(recording, and_return.recording); break;
                default:  next(err); return;
            }
        });
    });
    
});

router.get('/project/:projectUrl/species', function(req, res, next) {
    var project_url   = req.param('projectUrl');
});

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
        res.json(results);
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
                                {
                                    jobQueue.push({name: 'training'+trainingId},1,
                                        function()
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
                                                }
                                            );
                                            python.on('close',
                                                function(code)
                                                { 
                                                    if (code !== 0) { console.log('returned error')}
                                                    else console.log('no error, everything ok, training completed');
                                                }
                                            );
                                        }
                                    );
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
                                    jobQueue.push({name: 'classification'+classificationId},1,
                                        function()
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
                                    );
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

module.exports = router;
