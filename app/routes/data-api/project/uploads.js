var debug = require('debug')('arbimon2:route:uploads');
var router = require('express').Router();

var model = require('../../../model');

router.get('/processing', function(req, res, next) {
    res.type('json');
    model.uploads.getUploadingRecordings({
        project: req.project.project_id
    }).then(function(uploads){
        res.json(uploads);
    }, next);
});

router.get('/check', function(req, res, next) {
    res.type('json');

    checkStatus(req, res, next);
});

async function checkStatus(req, res, next) {
    const idToken = req.session.idToken
    const items = req.params.items
    for (let item of items) {
        try {
          const result = await model.uploads.checkStatus(item.uploadUrl, idToken, false)
          const status = !result || [30, 32].includes(result) ? 'error' : 'uploaded'
          model.uploads.updateState({ uploadId: item.id, status: status, uploadUrl: item.uploadUrl }, function(err){
            next(err)
          })
        } catch (e) {
            return next(err);
        }
      }
}

module.exports = router;
