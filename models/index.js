var util = require('util');
var fs = require('fs');
var mysql = require('mysql');
var validator = require('validator');
var config = require('../config');
var sha256 = require('../utils/sha256');

var dbpool = require('../utils/dbpool');

module.exports.users         = require('./users'        )(dbpool.queryHandler);
module.exports.projects      = require('./projects'     );
module.exports.recordings    = require('./recordings'   );
module.exports.sites         = require('./sites'        )(dbpool.queryHandler);
module.exports.training_sets = require('./training_sets');
module.exports.species       = require('./species'      )(dbpool.queryHandler);
module.exports.songtypes     = require('./songtypes'    )(dbpool.queryHandler);
