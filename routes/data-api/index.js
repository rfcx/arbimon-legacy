var express = require('express');
var router = express.Router();
var routes = {
    '/user'      : require('./user'),
    '/sites'     : require('./sites'),
    '/species'   : require('./species'),
    '/songtypes' : require('./songtypes'),
    '/project'   : require('./project'),
    '/orders'   : require('./orders')
};


Object.keys(routes).forEach(function(route){
    router.use(route, routes[route]);
});

// TODO move routes on models to their respective places
router.use("/", require('./models'));

module.exports = router;
