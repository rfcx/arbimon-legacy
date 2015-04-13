#!/usr/bin/env nodejs
var path = require('path');
var fs = require('fs');
var os = require('os');

var request = require('request');
var mysql = require('mysql');
var async = require('async');
var argv = require('minimist')(process.argv.slice(2));
var read = require("read");

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
        "       g.elevation as alt, \n"+
        "       p.name AS project_url \n"+
        "FROM arbimon.project_station AS ps \n"+
        "JOIN arbimon.station AS s ON s.id = ps.station_id \n"+
        "JOIN arbimon.geolocation_station AS gs ON ps.station_id = gs.station_id \n"+
        "JOIN arbimon.geolocation AS g ON gs.geolocation_id = g.id \n"+
        "JOIN arbimon.geo_area AS ga ON ga.geolocation_id = gs.geolocation_id \n"+
        "JOIN arbimon.study_area AS sa ON sa.id = ga.study_area_id \n"+
        "JOIN arbimon.project AS p ON sa.original_project_id = p.id \n"+
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

if(!argv.user && !argv.u) {
    console.log('missing db username');
    process.exit(1);
    return;
}
    
if(!argv.dbhost && !argv.h) {
    console.log('missing db host');
    process.exit(1);
    return;
}

if(!argv.project && !argv.p) {
    console.log('missing project id');
    process.exit(1);
    return;
}
    
var projectId = argv.project || argv.p;
var user = argv.user || argv.u;
var host = argv.dbhost || argv.h;
var arbimonOneDb;
var arbimonTwoDb;

var project = {};


var getSiteRecs = function(station, next) {
    console.log('station', station.name);
    
    async.waterfall([
        function(callback) {
            arbimonOneDb.query(q.stationRecordings, [station.station_id], function(err, rows) {
                if(err) return next(err);
                
                var getRec = function(rec, next2) {
                    rec.rec_data = JSON.parse(rec.rec_data);
                    
                    console.dir(rec);
                    
                    var file = path.basename(rec.rec_data.filename, path.extname(rec.rec_data.filename));
                    
                    var month = (rec.datetime.getMonth() + 1);
                    month = month < 10 ? "0" + month : "" + month;
                    
                    rec.filePath = "grabaciones_" + station.project_url + 
                                    "/" + station.name +
                                    "/" + rec.datetime.getFullYear() +
                                    "/" + month +
                                    "/" + file;
                    
                    var url = 'http://136.145.231.21/media/' + rec.filePath + '.flac';
                    console.log(url);
                    
                    request.get(url)
                        .pipe(fs.createWriteStream(path.join(os.tmpdir(), file + '.flac')))
                        .on('finish', function() {
                            arbimonOneDb.end();
                            arbimonTwoDb.release();
                            process.exit(1);
                        });
                    
                };
                
                async.eachSeries(rows, getRec, callback);
            });
        },
        function done() {
            next();
        }
    ]);
};

var main = function() {
    async.waterfall([
        function dbConnection1(callback) {
            read({ 
                    prompt: 'Enter the password for '+ user+': ', 
                    silent: true 
                }, 
                function(err, input) {

                arbimonOneDb = mysql.createConnection({
                    host: host,
                    user: user,
                    password: input
                });
                
                callback();
            });
        },
        function dbConnection2(callback) {
            dbpool.getConnection(function(err, db) {
                if(err) return callback(err);
                
                arbimonTwoDb = db;
                
                callback();
            });
        },
        function projectInfo(callback) {
            console.log('projectInfo');
            arbimonOneDb.query(q.projectInfo, [projectId], function(err, rows) {
                if(err) return callback(err);
                
                if(!rows.length) {
                    return callback('no project found');
                }
                
                project.info = rows;
                callback();
            });
        },
        function projectStations(callback) {
            console.log('projectStations');
            arbimonOneDb.query(q.projectStations, [projectId], function(err, rows) {
                if(err) return callback(err);
                
                if(!rows.length) {
                    return callback('no sites found');
                }
                
                project.sites = rows;
                callback();
            });
        },
        function stationRecs(callback) {
            console.log('stationsRecs');
            async.eachSeries(project.sites, getSiteRecs, callback);
        }
    ], 
    function done(err) {
        if(err) console.error(err);
        
        console.log('project');
        console.dir(project);
        // console.dir(project.sites[0].recs);
        arbimonOneDb.end();
        arbimonTwoDb.release();
    });
};


if(require.main === module) {
    main();
}
