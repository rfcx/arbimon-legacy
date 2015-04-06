#!/usr/bin/env nodejs
var readline = require('readline');
var mysql = require('mysql');
var argv = require('minimist')(process.argv.slice(2));

var dbpool = require('../../utils/dbpool');

var q = {
    projectInfo: 
        "SELECT p.name as url, \n"+
        "       p.title as name, \n"+
        "       description \n"+
        "FROM arbimon.project AS p \n"+
        "WHERE p.id = ?",
    
    projectStations: 
        "SELECT s.id as station_id, \n"+
        "       s.name, \n"+
        "       g.latitude as lat, \n"+
        "       g.longitude as lon, \n"+
        "       g.elevation as alt \n"+
        "FROM arbimon.project_station AS ps \n"+
        "JOIN arbimon.station AS s ON s.id = ps.station_id \n"+
        "JOIN arbimon.geolocation_station AS gs ON ps.station_id = gs.station_id \n"+
        "JOIN arbimon.geolocation AS g ON gs.geolocation_id = g.id \n"+
        "WHERE ps.project_id = ?",
    
    stationRecordings:
        "SELECT ed.id as event_data_id, \n"+
        "       date_time as datetime, \n"+
        "       CONCAT( '{', GROUP_CONCAT( CONCAT('\"',soda.attribute, '\":\"', edv.value, '\"') ), '}') as rec_data \n"+
        "FROM arbimon.station_sensor AS ss \n"+
        "JOIN arbimon.event_data AS ed ON ss.sensor_id = ed.sensor_id \n"+
        "JOIN arbimon.event_data_value AS edv ON ed.id = edv.event_data_id \n"+
        "JOIN arbimon.sensor_output_data_attrib AS soda ON edv.out_data_attrib_id = soda.id \n"+
        "WHERE ss.station_id = ? \n"+
        "GROUP BY ed.id",
    
    recValidations:
        "SELECT species_id, songtype_id, is_present \n"+
        "FROM identification_gio_db.species_validation AS sv \n"+
        "WHERE sv.event_data_id = ? ",
};

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var arbimonOneDb = mysql.createConnection({
    host : argv.dbhost || argv.h,
    user : argv.user || argv.u,
    password: ''
});

arbimonOneDb.query(q.projectInfo, [138], function(err, rows) {
    if(err) return console.error(err);
    
    console.log(rows);
    arbimonOneDb.end();
});

// dbpool.getConnection(function(err, db) {
//     if(err) return console.error(err);
    
// });
