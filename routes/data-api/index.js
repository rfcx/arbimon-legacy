var express = require('express');
var router = express.Router();
var routes = {
    '/user'      : require('./user'),
    '/species'   : require('./species'),
    '/songtypes' : require('./songtypes'),
    '/project'   : require('./project')
}


Object.keys(routes).forEach(function(route){
    router.use(route, routes[route]);
});

router.use("/",require('./model'));

module.exports = router;