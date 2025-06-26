const async = require('async');
const express = require('express');
const router = express.Router();
const csv_stringify = require("csv-stringify");
const moment = require('moment');
const model = require('../../../model');

router.get('/', function(req, res, next) {
    res.type('json');
    model.projects.getProjectSites(req.project.project_id, {
        compute:{
            rec_count: !!req.query.count
        },
        utcDiff: !!req.query.utcDiff
    }).then(async function(rows) {
        let deploymentData, deploymentBySite = {}
        if (req.query.deployment) {
            const idToken = req.headers.authorization?.split(' ')[1];
            try {
                deploymentData = await model.sites.getDeployedData(req.project.external_id, req.session.idToken === undefined ? idToken : req.session.idToken)
                deploymentData = JSON.parse(deploymentData)
                if (deploymentData && deploymentData.length) {
                    deploymentData.forEach(data => { return deploymentBySite[data.streamId] = {
                        streamId: data.streamId,
                        deployedAt: data.deployedAt
                    }})
                }
            } catch (e) {}
        }
        for (let row of rows) {
            const isTimezone = row.timezone
            const timezone = isTimezone ? moment().tz(row.timezone).format('ZZ') : '-0000' // UTC+07 , UTC+07:30, 'UTC-00'
            const utc = `${timezone.slice(0, 3)}:${timezone.slice(3)}`
            const reg = /^(.\d*[\d:]*?)\.?:00*$/.exec(utc)
            row.utc = reg && reg[1] ? `UTC${reg[1]}` : `UTC${utc}`
            if (deploymentBySite && deploymentBySite[row.external_id]) {
                row.deployment = deploymentBySite[row.external_id].deployedAt ? deploymentBySite[row.external_id].deployedAt : 0
            } else row.deployment = 0
        }
        res.json(rows);
    }).catch(next);
});

router.post('/create', function(req, res, next) {
    res.type('json');
    var project = req.project;
    var site = req.body.site;

    if(!req.haveAccess(project.project_id, "manage project sites")) {
        return res.json({ error: "you dont have permission to 'manage project sites'" });
    }

    model.sites.exists(site.name, project.project_id, async function(err, exists) {
        if(err) return next(err);

        if(exists)
            return res.json({ error: 'Site with same name already exists'});

        site.project_id = project.project_id;
        const idToken = req.headers.authorization?.split(' ')[1];

        try {
            await model.sites.createSiteInArbimonAndCoreAPI(site, project, req.session.idToken === undefined ? idToken : req.session.idToken);
            res.json({ message: "New site created" });
            model.projects.updateProjectLocation(project.project_id, site.lat, site.lon)
        }
        catch(e) {
            return next(err);
        }
    });
});

router.post('/update', function(req, res, next) {
    res.type('json');
    var project = req.project;
    var site = req.body.site;

    const idToken = req.headers.authorization?.split(' ')[1];
    console.log(req.body);

    if(!req.haveAccess(project.project_id, "manage project sites")) {
        return res.json({ error: "you dont have permission to 'manage project sites'" });
    }
    // Do not update project_id if the value is not changed
    if (site.project && site.project.project_id !== project.project_id) {
        site.project_id = site.project.project_id;
    }
    model.sites.find({ name: site.name, project_id: site.project_id || project.project_id }, async function(err, result) {
        if(err) return next(err);

        if (result.length && result[0].id ==! site.id) {
            return res.json({ error: 'Site with same name already exists'});
        }

        const options = {
            originalProjectId: project.project_id,
            projectExternalId: project.external_id
        }
        model.sites.updateSite(site, options, req.session.idToken === undefined ? idToken : req.session.idToken).then(function() {
            res.json({ message: 'Site updated' });
            model.projects.updateProjectLocation(project.project_id, site.lat, site.lon)
        }).catch(next);
    })
});

router.post('/delete', function(req, res, next) {
    res.type('json');
    const project = req.project;
    const sites = req.body.sites;
    const idToken = req.headers.authorization?.split(' ')[1];

    if(!req.haveAccess(project.project_id, "delete site")) {
        return res.json({ error: "you do not have permission to remove sites" });
    }

    model.sites.removeSite(sites, project.project_id, req.session.idToken === undefined ? idToken : req.session.idToken).then(function() {
        res.json({ message: 'Removed' });
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

module.exports = router;
