var util = require('util');
var fs = require('fs');
var mysql = require('mysql');
var validator = require('validator');
var config = require('../config');

var dbPool = mysql.createPool({
    host: config('db').host,
    user: config('db').user,
    password: config('db').password,
    database: config('db').database
});

var queryHandler = function (query, callback) {
    //~ util.puts(query);
    dbPool.getConnection(function(err, connection) {
        connection.query(query, function(err, rows, fields) {
            connection.destroy();
            callback(err, rows);
        });
    });
}

var Users = require('./users')(queryHandler);
var Projects = require('./projects')(queryHandler);

module.exports = {
    users: Users,
    projects: Projects
};




