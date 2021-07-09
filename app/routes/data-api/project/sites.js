var debug = require('debug')('arbimon2:route:playlists');
var async = require('async');
var express = require('express');
var router = express.Router();
var csv_stringify = require("csv-stringify");
var config = require('../../../config');
const rfcxConfig = config('rfcx');

var model = require('../../../model');

router.get('/', function(req, res, next) {
    res.type('json');
    model.projects.getProjectSites(req.project.project_id, {
        compute:{
            rec_count: !!req.query.count,
            has_logs: !!req.query.logs
        }
    }).then(function(rows) {
        res.json(rows);
    }).catch(next);
});

router.post('/create', function(req, res, next) {
    res.type('json');
    var project = req.project;
    var site = req.body.site;

    if(!req.haveAccess(req.project.project_id, "manage project sites")) {
        return res.json({ error: "you dont have permission to 'manage project sites'" });
    }

    model.sites.exists(site.name, project.project_id, async function(err, exists) {
        if(err) return next(err);

        if(exists)
            return res.json({ error: 'site with same name already exists'});

        site.project_id = project.project_id;

        try {
            await model.sites.createSiteInArbimonAndCoreAPI(site, project.external_id, req.session.idToken);
            res.json({ message: "New site created" });
        }
        catch(e) {
            return next(err);
        }
        res.json({ message: "New site created" });
    });
});

// router.post('/import', function(req, res, next) {
//     var project = req.project;
//     var site = req.body.site;
//
//     if(!req.haveAccess(project.project_id, "manage project sites")) {
//         return res.json({ error: "you dont have permission to 'manage project sites'" });
//     }
//
//     model.sites.importSiteToProject(site.id, project.project_id, function(err, rows) {
//         if(err) return next(err);
//
//         debug(rows);
//         res.json({ msg: "site imported", success: true });
//     });
// });

router.post('/update', function(req, res, next) {
    res.type('json');
    var project = req.project;
    var site = req.body.site;

    console.log(req.body);

    if(!req.haveAccess(project.project_id, "manage project sites")) {
        return res.json({ error: "you dont have permission to 'manage project sites'" });
    }

    site.project_id = site.project? site.project.project_id : project.project_id;

    model.sites.updateSite(site, { ...req.session.user, user_id: req.session.user.id }, req.session.idToken).then(function() {
        res.json({ message: 'Site updated' });
    }).catch(next);
});

router.post('/delete', function(req, res, next) {
    res.type('json');
    var project = req.project;
    var site = req.body.site;

    if(!req.haveAccess(project.project_id, "manage project sites")) {
        return res.json({ error: "you dont have permission to 'manage project sites'" });
    }

    model.sites.removeSite(site.id, project.project_id, req.session.idToken).then(function() {
        res.json({ message: 'Site removed' });
    }).catch(next);
});

router.param('siteid', function(req, res, next, siteid){
    model.sites.findById(siteid,
    function(err, sites) {
        if(err) return next(err);

        if(!sites.length){
            return res.status(404).json({ error: "site not found"});
        }
        req.site = sites[0];
        return next();
    });
});

router.get('/:siteid/logs', function(req, res, next){
    res.type('json');
    model.sites.getLogFileList(req.site, function(err, logFileList){
        if(err){
            next(err);
        } else {
            res.json(logFileList);
        }
    });
});

router.get('/:siteid/uploads.txt', function(req, res, next){
    var options={};
    var output='csv', groupby;
    if (req.query) {
        if (req.query.get && req.query.get == 'dates') {
            options.only_dates = true;
            output='json';
            groupby='dates';
        } else {
            if(req.query.from){
                options.from = new Date(+req.query.from);
            }
            if(req.query.to){
                options.to = new Date(+req.query.to);
            }
            if (req.query.date) {
                options.dates = req.query.date.split(',');
                output='csv';
            }
            if(req.query.q){
                options.quantize = req.query.q;
            }
        }
    }
    model.sites.getUploadStats(req.site, options, function(err, datastream, fields){
        if(err){
            next(err);
        } else {
            fields = fields.map(function(f){return f.name;});
            switch(output){
                case 'json':
                    res.type('application/json');
                    var rows;
                    if(groupby){
                        rows = {};
                        fields = fields.filter(function(f){return f != groupby;});
                        datastream.on('data', function(row){
                            var idx = row[groupby];
                            delete row[groupby];
                            rows[idx] = fields.length == 1 ? row[fields[0]] : row;
                        });
                        datastream.on('end', function(row){
                            res.json(rows);
                        });
                    }
                break;
                default:
                    res.type('text/plain');
                    datastream
                        .pipe(csv_stringify({
                            header:true,
                            columns:fields
                        }))
                        .pipe(res);
            }
        }
    });
});
router.get('/:siteid/data.txt', function(req, res, next){
    var options={};
    var output='csv', groupby;
    if (req.query) {
        if (req.query.get && req.query.get == 'dates') {
            options.only_dates = true;
            output='json';
            groupby='dates';
        } else {
            if(req.query.from){
                options.from = new Date(+req.query.from);
            }
            if(req.query.to){
                options.to = new Date(+req.query.to);
            }
            if (req.query.date) {
                options.dates = req.query.date.split(',');
                output='csv';
            }
            if(req.query.q){
                options.quantize = req.query.q;
            }
        }
    }
    model.sites.getRecordingStats(req.site, options, function(err, datastream, fields){
        if(err){
            next(err);
        } else {
            fields = fields.map(function(f){return f.name;});
            switch(output){
                case 'json':
                    res.type('application/json');
                    var rows;
                    if(groupby){
                        rows = {};
                        fields = fields.filter(function(f){return f != groupby;});
                        datastream.on('data', function(row){
                            var idx = row[groupby];
                            delete row[groupby];
                            rows[idx] = fields.length == 1 ? row[fields[0]] : row;
                        });
                        datastream.on('end', function(row){
                            res.json(rows);
                        });
                    }
                break;
                default:
                    res.type('text/plain');
                    datastream
                        .pipe(csv_stringify({
                            header:true,
                            columns:fields
                        }))
                        .pipe(res);
            }
        }
    });
});
router.get('/:siteid/log/data.txt', function(req, res, next){
    var options={};
    var output='csv', groupby;
    if (req.query) {
        if (req.query.get && req.query.get == 'dates') {
            options.only_dates = true;
            output='json';
            groupby='dates';
        } else {
            if(req.query.stat){
                options.stat = req.query.stat.split(',');
            }
            if(req.query.from){
                options.from = new Date(+req.query.from);
            }
            if(req.query.to){
                options.to = new Date(+req.query.to);
            }
            if (req.query.date) {
                options.dates = req.query.date.split(',');
                output='csv';
            }
            if(req.query.q){
                options.quantize = req.query.q;
            }
        }
    }
    model.sites.getDataLog(req.site, options, function(err, datastream, fields){
        if(err){
            next(err);
        } else {
            fields = fields.map(function(f){return f.name;});
            switch(output){
                case 'json':
                    res.type('application/json');
                    var rows;
                    if(groupby){
                        rows = {};
                        fields = fields.filter(function(f){return f != groupby;});
                        datastream.on('data', function(row){
                            var idx = row[groupby];
                            delete row[groupby];
                            rows[idx] = fields.length == 1 ? row[fields[0]] : row;
                        });
                        datastream.on('end', function(row){
                            res.json(rows);
                        });
                    }
                break;
                default:
                    res.type('text/plain');
                    datastream
                        .pipe(csv_stringify({
                            header:true,
                            columns:fields
                        }))
                        .pipe(res);
            }
        }
    });
});

router.post('/generate-token', function(req, res, next){
    res.type('json');
    if(!req.haveAccess(req.project.project_id, "manage project sites")) {
        return res.json({ error: "you dont have permission to 'manage project sites'" });
    }
    if(!req.haveAccess(req.project.project_id, "manage project recordings")) {
        return res.json({ error: "you dont have permission to 'manage project recordings'" });
    }
    var siteId = req.body.site;
    async.waterfall([
        function(next){
            model.sites.findById(siteId, next);
        },
        function(sites){
            var next = arguments[arguments.length-1];
            if(sites.length){
                model.sites.generateToken(sites[0], next);
            } else {
                next(new Error('Cannot find site ' + siteid));
            }
        }
    ], function(err, tokenData){
        if(err) return next(err);

        tokenData.base64token = new Buffer(tokenData.token).toString('base64');

        res.json(tokenData);
    });
});

router.post('/revoke-token', function(req, res, next){
    res.type('json');
    if(!req.haveAccess(req.project.project_id, "manage project sites")) {
        return res.json({ error: "you dont have permission to 'manage project sites'" });
    }
    else if(!req.haveAccess(req.project.project_id, "manage project recordings")) {
        return res.json({ error: "you dont have permission to 'manage project recordings'" });
    }
    else {
        var siteid = req.body.site;
        async.waterfall([
            function(next){
                model.sites.findById(siteid, next);
            },
            function(sites){
                var next = arguments[arguments.length-1];
                if(sites.length){
                    model.sites.revokeToken(sites[0], next);
                } else {
                    next(new Error('Cannot find site ' + siteid));
                }
            }
        ], function(err){
            if(err){
                next(err);
            } else {
                res.json({message:"token revoked"});
            }
        });
    }
});


module.exports = router;
