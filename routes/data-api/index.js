var path = require('path');
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
];


routes.forEach(function(route){
    router.use(route, require(path.join('.', route)));
});

// TODO move routes on models to their respective places
router.use("/", require('./models'));



module.exports = router;
