const express = require('express');
const router = express.Router();
const config = require('../../../config');
const request = require('request');
const rfcxConfig = config('rfcx');

// project-scope: allow authorisation delegated: proxied to device-api with the caller's own bearer token
router.get('/:site_id/assets', async function(req, res){
    const url = `${rfcxConfig.deviceBaseUrl}/streams/${req.params.site_id}/assets`;
    request.get(url, {
        headers: {
        'Authorization': `Bearer ${req.session.idToken}`
        }
    }).pipe(res);

});

// project-scope: allow authorisation delegated: proxied to device-api with the caller's own bearer token
router.get('/:site_id/assets/:asset_id', async function(req, res){
    const url = `${rfcxConfig.deviceBaseUrl}/assets/${req.params.asset_id}`;
    request.get(url, {
        headers: {
        'Authorization': `Bearer ${req.session.idToken}`
        },
        respondType: 'blob'
    }).pipe(res);

});

module.exports = router;

// RED-TEST PROBE (rfcx-local §391) — DO NOT MERGE. An unguarded id param, the sites.js shape.
router.param('probeSite', function(req, res, next, id){ model.sites.findById(id, function(){ next(); }); });
router.get('/probe/:probeSite', function(req, res){ res.json({}); });
