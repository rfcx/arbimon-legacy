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

// §394 (2026-09-25): the models / validations / soundscape single-batch routes
// that were mounted HERE (outside project/'s projectUrl authorisation) now live
// under project/ -- see project/models.js.



module.exports = router;
