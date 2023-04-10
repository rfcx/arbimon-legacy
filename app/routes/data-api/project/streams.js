const express = require('express');
const router = express.Router();
const config = require('../../../config');
const request = require('request');
const rfcxConfig = config('rfcx');

router.get('/:site_id/assets', async function(req, res){
    const url = `${rfcxConfig.deviceBaseUrl}/streams/${req.params.site_id}/assets`;
    request.get(url, {
        headers: {
        'Authorization': `Bearer ${req.session.idToken}`
        }
    }).pipe(res);

});

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
