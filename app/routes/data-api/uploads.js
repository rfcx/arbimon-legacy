var fs = require('fs');
var express = require('express');
var router = express.Router();
var async = require('async');
var util = require('util');
var _ = require('lodash');
var q = require('q');

const fileHelper = require('../../utils/file-helper')
var model = require('../../model');
var tmpFileCache = require('../../utils/tmpfilecache');
var formatParse = require('../../utils/format-parse');
const uploadQueue = require('../../utils/upload-queue');

var deleteFile = function(filename) {
    fs.unlink(filename, function(err) {
        if(err) console.error("failed to delete: %s", filename);
    });
};

// middleware to handle upload auth
var authorize = function(authtype){
    return function(req, res, next) {
        // if(req.systemSettings('feature.uploads') == 'off') {
        //     return res.status(503).json({ error: 'uploads are unavailable, try again later' });
        // }
        console.log('--authorize', req.query.project)
        var accessToken = req.get('X-X-access-token-X-X') || req.body.token;

        if(authtype.session && req.session && req.session.loggedIn) {
            if(!req.query.project || !req.query.site || !req.query.nameformat || !req.query.timezone) {
                console.error('--missing parameters', req.query.project, req.query.site, req.query.nameformat, req.query.timezone)
                return res.status(400).json({ error: 'missing parameters' });
            }

            console.log('project_id: %s | site_id: %s |format: %s |timezone: %s',
                req.query.project,
                req.query.site,
                req.query.nameformat,
                req.query.timezone
            );

            var perm = 'manage project recordings';

            if(!req.haveAccess(req.query.project, perm)) {
                console.error(`you dont have permission to ${ perm }`)
                res.status(401).json({
                    error: `you dont have permission to ${ perm }`
                });
                return;
            }

            req.upload = {
                userId: req.session.user.id,
                projectId: Number(req.query.project),
                siteId: Number(req.query.site),
                nameFormat: req.query.nameformat,
                timezone: req.query.timezone,
            };

            next();
        }

        // verify token
        else if(authtype.token && req.token) {

            req.upload = {
                userId: 0,
                projectId: Number(req.token.project),
                siteId: Number(req.token.site),
                nameFormat: 'Arbimon',
                timezone: 'local',
            };

            next();
        }

        // verify access token
        else if(authtype.access_token && accessToken) {
            res.type('json');
            return model.AccessTokens.verifyTokenAccess(accessToken, 'manage project recordings', {requireScope:true, requireProject:true}).then(function(resolvedToken){
                return model.users.hasProjectAccess(resolvedToken.user, resolvedToken.project, {required:true}).then(function(){
                    req.upload = {
                        userId: resolvedToken.user,
                        projectId: Number(resolvedToken.project),
                        siteId: Number(resolvedToken.site),
                        nameFormat: resolvedToken.nameFormat || 'any',
                        timezone: resolvedToken.timezone || 'local',
                    };
                });
            }).finally(next);
        }
        else {
            // error not logged user nor site token
            return res.sendStatus(401);
        }
    };
};

var verifySite = function(req, res, next) {
    model.sites.findById(req.upload.siteId, function(err, rows) {
        if(err) return next(err);

        if(!rows.length) {
            return res.status(403).json({ error: "site does not exist" });
        }

        var site = rows[0];
        console.log('--site  to upload', site)
        if(site.project_id !== req.upload.projectId) {
            return res.status(403).json({ error: "site does not belong to project"});
        }

        next();
    });
};

var receiveUpload = function(req, res, next) {
    res.type('json');

    var upload = {};
    var error = false;

    if(!req.busboy) return res.status(400).json({ error: "no data" });

    req.busboy.on('field', function(fieldname, val) {
        console.log('field %s = %s', fieldname, val);
    });

    req.busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
        console.log('file fieldname: %s | filename: %s', fieldname, filename);

        // FFI -> filename format info
        try {
            upload.FFI = formatParse(req.upload.nameFormat, filename);
        }
        catch(e) {
            file.resume();
            error = true;
            return res.status(400).json({ error: e.message });
        }

        var saveTo = tmpFileCache.key2File(Date.now()+filename);
        //                                 ^__ concat now() to prevent collitions
        file.pipe(fs.createWriteStream(saveTo));

        upload.name = filename;
        upload.path = saveTo;
        upload.timezone = req.upload.timezone

    });

    req.busboy.on('finish', function() {
        if(error) return;

        console.log('filename: ', upload.name);

        async.waterfall([
            function recNotExists(callback) {
                model.recordings.exists({
                    site_id: req.upload.siteId,
                    filename: upload.FFI.filename
                }, function(err, exists) {
                    if(err) return next(err);

                    if(exists) {
                        deleteFile(upload.path);
                        var msg = "filename "+ upload.FFI.filename +
                                    " already exists on site " + req.upload.siteId;
                        return res.status(403).json({ error: msg });
                    }

                    callback();
                });
            },
            function sendToProcess(callback) {
                upload.projectId = req.upload.projectId;
                upload.siteId = req.upload.siteId;
                upload.userId = req.upload.userId;
                const idToken = req.session.idToken
                const uploadsBody = {
                    originalFilename: upload.name,
                    filePath: upload.path,
                    fileExt: fileHelper.getExtension(upload.name),
                    streamId: upload.siteId
                }
                uploadQueue.enqueue(upload, uploadsBody, idToken, function(err) {
                    if(err) return next(err);

                    res.status(202).json({ success: "upload processing" });
                });
            }
        ]);

    });

    req.pipe(req.busboy);
};

router.post('/audio', authorize({session:true, token:true, access_token:true}), verifySite, receiveUpload);

module.exports = router;
