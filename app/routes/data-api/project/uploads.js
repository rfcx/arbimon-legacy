var debug = require('debug')('arbimon2:route:uploads');
var router = require('express').Router();

var model = require('../../../model');

router.get('/processing', function(req, res, next) {
    res.type('json');

    model.uploads.getUploadingRecordings({
        project: req.project.project_id,
        site: req.query.site
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
    const queryItems = Array.isArray(req.query.items) ? req.query.items : [req.query.items]
    const items = queryItems.map(i => { return JSON.parse(i) })
    for (let item of items) {
        if (!item.uploadUrl) return
        const code = await model.uploads.checkStatus(item.uploadUrl, idToken)
        if (code) {
            const status = getStatus(code)
            item.status = status
            await  model.uploads.updateStateAsync({ uploadId: item.id, status: status, uploadUrl: item.uploadUrl })
        }
    }
    res.json({ items: items });
}

const getStatus = function (code) {
    switch (code) {
        case 0: return 'waiting';
        case 10: return 'waiting';
        case 20: return 'uploaded';
        case 30: return 'error';
        case 32: return 'error';
        default: return 0
    }
}

module.exports = router;
