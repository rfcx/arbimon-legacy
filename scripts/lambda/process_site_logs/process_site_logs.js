var mysql = require('mysql');
var q = require('q');
var site_log_processor = require('./site_log_processor');

if(module.id == '.'){
    var config = require('../../../config');
    
    var args = process.argv.slice(2);
    var site_id = args.shift() | 0;
    var db;
    
    
    q().then(function(){
        db = mysql.createConnection(config('db'));
        db.connect();
    }).then(function(){
        return site_log_processor.process_site_logs(
            args.length > 0 ? {file:args.shift()} : {name:'stdin', stream:process.stdin},
            site_id,
            db
        );
    }).catch(function(err){
        console.log("err:", err.stack);
    }).finally(function(){
        if(db){
            db.end();
        }
    });
}