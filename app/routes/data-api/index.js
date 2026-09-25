var express = require('express');
var router = express.Router();
var routes = [
    '/user',
    '/species',
    '/species_taxons',
    '/songtypes',
    '/project',
    '/jobs',
    '/masquerade',
];


routes.forEach(function(route){
    router.use(route, require('.' + route));
});

// TODO move routes on models to their respective places
router.use("/", require('./models'));
// 2026-09-24: auth-gated arbimon2 image proxy (replaces public s3.arbimon.org/arbimon2 URLs).
router.use('/arbimon2-asset', require('./arbimon2-assets'));



module.exports = router;
