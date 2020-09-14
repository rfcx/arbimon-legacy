var express = require('express');
var router = express.Router();
var routes = [
    '/user',
    '/sites',
    '/species',
    '/songtypes',
    '/project',
    '/orders',
    '/jobs',
    '/app-listings',
    '/rfcx',
];


routes.forEach(function(route){
    router.use(route, require('.' + route));
});

// TODO move routes on models to their respective places
router.use("/", require('./models'));



module.exports = router;
