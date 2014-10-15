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
    var sql = query.sql || query;
    console.log('- query : -|', sql.replace(/\n/g,'\n             '));

    dbPool.getConnection(function(err, connection) {
        if(err)
            return callback(err);

        connection.query(query, function(err, rows, fields) {
            connection.release();
            // for debugging
            if(err) {
                console.log('  failed :| ', err+"");
            } else if (rows) {
                if(rows.length != undefined) {
                    console.log('  returned :', rows.length , " rows.");
                }
                if(rows.affectedRows != undefined) {
                    console.log('  affected :', rows.affectedRows , " rows.");
                }
                if(rows.changedRows != undefined) {
                    console.log('  changed  :', rows.changedRows , " rows.");
                }
                if(rows.insertId != undefined) {
                    console.log('  insert id :', rows.insertId , " rows.");
                }
            }
            callback(err, rows, fields);
        });
    });
};

var models = [
    'users',
    'projects',
    'recordings',
    'sites',
    'training_sets',
    'species',
    'songtypes'
]

models.forEach(function(model){
    module.exports[model] = require('./'+model)(queryHandler);
});
