var fs = require('fs');
var path = require('path');
var q = require('q');
var streaming = require('./streaming');
var parser = require('./parser');
var site_logger = require('./site_logger');


/** Processes site logs and adds them to the database.
 * @param{Object|Array} logfile - logfile, can be an object or an array of objects.
 * @param{String} logfile.stream - stream holding the the site's log data.
 * @param{String} logfile.uri - uri associated to this log data.
 * @param{Integer} site_id - id of the site to add this log data to.
 * @param{Object} db - opened connection to the database.
 * @return {Promise} resolved when all log data has been read and added to the database as one transaction per file, rejected otherwise.
 * @note if there is already an entry for the (site_id, logfile.uri) pair, then this is does nothing.
 */
function process_one_logfile(logfile, site_id, db){
    var _site_logger;
    return q().then(function(){
        return q.ninvoke(db, 'query', "SELECT site_log_file_id as id FROM site_log_files WHERE site_id = ? AND uri = ?", [site_id, logfile.uri]);
    }).then(function(results){
        if(results && results[0] && results[0].length){
            console.log("skipping " + logfile.uri  + ": already added to db (id:" + results[0][0].id + ").");
        } else {
            return q.ninvoke(db, 'query', "BEGIN").then(function(){
                var d = q.defer();
                _site_logger = site_logger.site_logger(site_id, db);
                streaming.make_stream_pipeline([
                    logfile.stream, 
                    streaming.line_chopper(), 
                    parser.log_entry_parser(),
                    parser.log_entry_to_site_entry_processor(),
                    _site_logger, 
                    streaming.dev_null()
                ], {pipe_errors:true})
                    .on('error', d.reject.bind(d))
                    .on('finish', d.resolve.bind(d));
                return d.promise;
            }).then(function(){
                return q.ninvoke(db, 'query', "INSERT INTO site_log_files(site_id, log_start, log_end, uri) VALUES (?, ?, ?, ?)", [
                    site_id, _site_logger.$stats.min_date || '0000-00-00', _site_logger.$stats.max_date || '0000-00-00', logfile.uri 
                ]);
            }).then(function(){
                console.log(_site_logger.$stats);
                console.log("processed " + logfile.uri  + ":", _site_logger.$stats.count);
                return q.ninvoke(db, 'query', "COMMIT");
            }, function(err){
                console.error("error processing " + logfile.uri  + ":", err);        
                return q.ninvoke(db, 'query', "ROLLBACK");
            });
        }
    });

}

/** Loops through an array, applying loopFn and using the promise API.
 * Processes each item in order using loopFn, but stops after each iteration
 * to resolve any pending promises returned by loopFn.
 * @param{Array} array - array to loop
 * @param{Function} loopFn - function used in loop.
 * @return {Promise} resolved after loopFn is called with every item in the array,
 *      rejected if loopFn(item) or its promises are rejected.
 */
function promisedLoop(array, loopFn){
    function loopVal(){
        return loopFn(array.shift());
    }
    function looper(){
        if(array.length){
            return q().then(loopVal).then(looper);
        }
    }
    
    return q(looper());
}

/** Processes site logs and adds them to the database.
 * @param{Object|Array} logfile_arg - logfile argument, can be an object or an array of objects.
 * @param{String} logfile_arg.file - path to file holding the site's log data, if its a folder, the all *.txt files are treated as log files.
 * @param{String} logfile_arg.stream - stream holding the the site's log data.
 * @param{String} logfile_arg.name - name associated to this log data.
 * @param{String} logfile_arg.datetime - datetime associated to this log data.
 * @param{Integer} site_id - id of the site to add this log data to.
 * @param{Object} db - opened connection to the database.
 * @return {Promise} resolved when all log data has been read and added to the database as one transaction per file, rejected otherwise.
 */
function process_site_logs(logfile_arg, site_id, db){
    return q().then(function(){
        if(logfile_arg.file){ 
            return q.nfcall(fs.stat, logfile_arg.file).then(function(stat){
                if(stat.isDirectory()){
                    return q.nfcall(fs.readdir, logfile_arg.file).then(function(subfile_list){
                        return subfile_list.filter(function(_){
                            return /\.txt$/.test(_);
                        }).map(function(_){
                            return {file:path.join(logfile_arg.file, _)};
                        });
                    });
                } else {
                    return [logfile_arg];
                }
            });
        } else if(logfile_arg instanceof Array){
            return logfile_arg;
        } else {
            return [logfile_arg];
        }
    }).then(function(logfile_array){
        return promisedLoop(logfile_array, function(logfile){
            if(!logfile.uri){
                if(logfile.file){
                    logfile.uri = "file://"+logfile.file;
                } else if(logfile.name){
                    logfile.uri = "named://" + logfile.name + "/" + (new Date().getTime());
                }
            }
            if(!logfile.stream && logfile.file){
                logfile.stream = fs.createReadStream(logfile.file);
            }
            
            return process_one_logfile(logfile, site_id, db);
            // console.log(logfile.file || logfile.name);
        });
    });    
}


module.exports = {
    process_one_logfile : process_one_logfile,
    process_site_logs : process_site_logs,
};