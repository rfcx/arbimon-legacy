var util = require('util');
var fs = require('fs');
var mysql = require('mysql');
var validator = require('validator');
var config = require('../config');
var sha256 = require('../utils/sha256');

var dbPool = mysql.createPool({
    host: config('db').host,
    user: config('db').user,
    password: config('db').password,
    database: config('db').database
});

var queryHandler = function (query, callback) {
    
    // for debugging
    util.puts(query); 
    
    dbPool.getConnection(function(err, connection) {
        connection.query(query, function(err, rows, fields) {
            connection.release();
            callback(err, rows, fields);
        });
    });
}

var Users = require('./users')(queryHandler);
var Projects = require('./projects')(queryHandler);

module.exports = {
    users: Users,
    projects: Projects
};




