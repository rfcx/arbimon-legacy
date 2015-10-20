var fs = require('fs');
var path = require('path');
var mysql = require('mysql');
var q = require('q');
var stream = require('stream');

/** Makes a stream-making function.
 * @param {Object} stream_args - parameters to pass to stream constructor.
 * @param {Object} options - options defining the stream maker function.
 * @param {Function/String} options.type - Type of stream to build. optional.
            default type is computed: if options.transform is given, then default 
            type is stream.Transform, else if options.read and options.write are 
            given,  it's stream.Duplex, else if only options.read is given, it's 
            stream.Readable, else if only options.write is given, it's 
            stream.Writable.
 * @param {Function} options.initialize - function to initialize the stream based 
 *          on given parameters.
 * @param {Function} options.transform - function managing the stream's input to 
 *          output transformation. optional.
 * @param {Function} options.flush - function managing the stream's flush requests. optional.
 * @param {Function} options.read - function managing the stream's input. optional.
 * @param {Function} options.write - function managing the stream's output. optional.
 * @param {Any} options.$* - gets set as a stream attribute.
 */
function make_stream_fn(stream_args, options){
    var stream_type;
    var constructor;
    var attribs=[];
    
    if(options === undefined && stream_args){
        options = stream_args;
        stream_args = undefined;
    }
    
    if(options.type){
        stream_type = (options.type instanceof Function) ? options.type : stream[options.type];
        delete options.type;
    }

    if(options.initialize){
        constructor = options.initialize;
        delete options.initialize;
    }

    if(!stream_type){
        stream_type = options.transform ? stream.Transform : (
            options.read ? (
                options.write ? stream.Duplex : stream.Readable
            ) : (
            options.write ? stream.Writable : undefined
        ));
    }
    
    for(var o in options){
        if(/transform|flush|read|write/.test(o)){
            attribs.push(['_' + o, options[o]]);
        } else if(/^\$/.test(o)){
            attribs.push([o, options[o]]);
        }
    }

    var fn = function(){
        var _stream = new stream_type(stream_args);
        attribs.forEach(function(a){
            _stream[a[0]] = a[1];
        });
        if(constructor){
            constructor.apply(_stream, Array.prototype.slice.call(arguments));
        }
        return _stream;
    };
    return fn;
}
/** Returns a transform stream that chops its input into string lines.
 * @return {stream.Transform} that reads an input buffer, and outputs string objects of the lines in the buffer.
 */
var line_chopper = make_stream_fn({objectMode:true}, {
    $lastLineData:'',
    transform: function (chunk, encoding, done) {
        var data = chunk.toString();
        if(this.$lastLineData){
            data = this.$lastLineData + data;
        }
        
        var lines = data.split('\n');
        this.$lastLineData = lines.splice(lines.length-1,1)[0];
        lines.forEach(this.push.bind(this));
        done();
    },
    flush: function (done) {
        if(this.$lastLineData){ 
            this.push(this.$lastLineData);
        }
        this.$lastLineData = null;
        done();
    }
});
/** Returns a write stream that just consumes the stream.
 * @return {stream.Writable} that just consumes the stream.
 */
var dev_null = make_stream_fn({objectMode:true}, {
    write: function (line, encoding, done) {
        done();
    }
});

/** Returns a stream that transforms raw text lines from a log into log entries.
 * @return {stream.Transform} stream that transforms raw text lines from a log into log entries.
 */
var log_entry_parser = make_stream_fn({objectMode:true}, {
    transform: function(line, _, done){
        var m = /^([^-]+) - ?(.*)$/.exec(line);
        var entry = m && parse_log_entry(m[2]);
        if(entry){
            entry.date = parse_date(m[1].trim());
            this.push(entry);
            done();
        }
    }
});
/** Parses a java date string to javascript.
 * @param {String} datestr -  string containing date in java format.
 * @return {Date} with the datetime represented by datestr.
 */
function parse_date(datestr){
    var d;
    if((d = /^(\w+ \w+ \d+) (\d+:\d+:\d+) ([^ ]+) (\d+)$/.exec(datestr))){
        if(!/^(GMT.+|\([^)]+\))$/.test(d[3])){
            d[3] = '(' + d[3] + ')';
        }
        d = [d[1],d[4],d[2],d[3]].join(' ');
    }
    return new Date(d);
}
/** Parses a log entry from its textual representation. 
 * @param {String} a log entry line.
 * @return {Object} representing the parsed log entry.
 */
function parse_log_entry(line){
    var comps = /^([^:]*):(.*)$/.exec(line);
    var data;
    if(comps){
        data = {tag:comps[1].trim().toLowerCase().replace(/\W/,'')};
        line = comps[2].trim();        
        switch(data.tag){
            case 'network':
                if(line == 'disconnected. No NetworkInfo.'){ 
                    data.connected = null;
                } else if(/^connected\./i.test(line)){
                    data.connected = line.substr(10).trim();
                } else {
                    data.tag = 'notice';
                    data.line = line;
                }
            break;
            case 'powerstate':
                line = /^\[?(.*?)\]?$/.exec(line)[1];
                comps = line.split(',');
                power = comps.shift().split('/');
                data.power = 100 * (+power[0]) / (+power[1]);
                comps.forEach(function(c){
                    var kv = c.split(':');
                    data[kv[0].trim().toLowerCase()] = kv[1].toLowerCase();
                });
                data.battery = data.battery == 'yes';
                data.voltage = 1*(data.voltage || -1);
                data.temp = (data.temp || -1) / 10;
                if(data.tech == 'null'){
                    data.tech = null;
                }
            break;
            case 'resetalarm': break;
            case 'notice': data.message = line; break;
            default: data.line = line; break;
        }
    }
    return data;    
}
/** Returns a stream that transforms parsed log entries into site log entries.
* @return {stream.Transform} stream that transforms parsed log entries into site log entries.
*/
var log_entry_to_site_entry_processor = make_stream_fn({objectMode:true}, {
    transform: function(log_entry, _, done){
        var _entry;
        switch(log_entry.tag){
            case 'notice'     : _entry = ['event', {date:log_entry.date, type:'notice', message:log_entry.message }]; break;
            case 'config'     : _entry = ['event', {date:log_entry.date, type:'config', message:log_entry.line    }]; break;
            case 'resetalarm' : _entry = ['event', {date:log_entry.date, type:'alarm', message:'Radio Reset Alarm'}]; break;
            case 'network'    : _entry = ['connection', {date:log_entry.date, connection:log_entry.connected     }]; break;
            case 'powerstate' : _entry = ['data', {date:log_entry.date, 
                    power: log_entry.power, battery: log_entry.battery, health: log_entry.health, status: log_entry.status,
                    plug_type: log_entry.plug, bat_tech: log_entry.tech, temp: log_entry.temp, voltage: log_entry.voltage,
            }]; break;
            // default: this.push(log_entry); break;
        }
        if(_entry){
            this.push(_entry);
        }
        done();
    }
});

/** Returns a stream that adds site log entries to a given site's log and returns the entry ids.
* @return {stream.Transform} stream that adds site log entries to a given site's log and returns the entry ids.
*/
var site_logger = make_stream_fn({objectMode:true}, {
    initialize: function(site_id, dbconnection){
        this.site_id = site_id;
        this.db = dbconnection;
        this.$stats = {count:0};
    },
    transform: function(log_entry, _, done){
        // console.log(log_entry);
        var log_type = log_entry[0], data = log_entry[1];
        var log_adder = '$add_'+log_type+'_log_entry';
        this.$stats.count++;
        if(!this.$stats.min_date || this.$stats.min_date > data.date){ 
            this.$stats.min_date = data.date;
        }
        if(!this.$stats.max_date || this.$stats.max_date < data.date){ 
            this.$stats.max_date = data.date;
        }
        if(this[log_adder]){
            this[log_adder](data)
                .then((function(results){
                    this.push(results);
                }).bind(this)).then(
                    function(){
                        done();
                    }, 
                    (function(err){
                        done(err);
                    }).bind(this)
                );
        } else {
            done();
        }
    },
    $exec_query : function(sql, data){
        sql = data ? mysql.format(sql, data) : sql;
        return q.ninvoke(this.db, 'query', sql, data);
    },    
    /** Returns the id for a given type's value.
     * @param {String} id_type - type of the value whose id is requested 
     * @param {String} value - value whose id is requested 
     * @param {Boolean} is_nullable -if true, null or undefined values resolve to null, otherwise they get rejected.
     * @return {q.Promise} Promise resolving to an id representing the given value of the given type, or rejecting with an error if not possible.
     */
    $get_id_for: function(id_type, value, is_nullable){
        var ids = this.$type_ids[id_type];
        if(!ids){
            return q.reject(new Error("Invalid id type '" + id_type + "'."));
        } else if(is_nullable && (value === undefined || value === null)){
            return q(null);
        } else if(ids.cached && ids.cached[value]){
            return q(ids.cached[value]);
        } else {
            return (ids.query_sql ? 
                this.$exec_query(ids.query_sql, [value]) : 
                q()
            ).then((function(results){
                if(results && results[0] && results[0][0]){
                    return results[0][0].id;
                } else if(ids.insert_sql){
                    return this.$exec_query(ids.insert_sql, [value]).then(function(results){
                        return results && results[0] && results[0].insertId;
                    });
                }
            }).bind(this)).then(function(id){
                if(id){
                    if(!ids.cached){
                        ids.cached = {};
                    }
                    ids.cached[value] = id;
                    return id;
                } else {
                    throw new Error(id_type + " id for value '" + value + "' not found.");
                }
            });
        }        
    },
    /** $get_id_for type definitions.
     * each entry has one of:
     *   {String} query_sql - string to query for the id of a given value.
     *   {String} insert_sql - string to insert a given value (optional).
     *   {Object} cached - cache of fetched values (optional).
     */
    $type_ids : {
        connection_type : {
            query_sql:"SELECT type_id as id FROM site_connection_types WHERE type = ?", 
            insert_sql:"INSERT INTO site_connection_types(type) VALUES (?)", 
            // cached:{
            //     'mobile(LTE)'     : 1,
            //     'mobile(HSPA+)'   : 2,
            //     'mobile(HSDPA)'   : 3,
            //     'mobile(UMTS)'    : 4,
            //     'mobile(EDGE)'    : 5,
            //     'mobile(UNKNOWN)' : 6,
            //     'mobile(GPRS)'    : 7,
            //     'WIFI()'          : 8,
            // }
        },
        health_type : {
            query_sql:"SELECT health_type_id as id FROM site_data_log_health_types WHERE type = ?", 
            insert_sql:"INSERT INTO site_data_log_health_types(type) VALUES (?)", 
            // cached:{
            //     'unknown'         : 1,
            //     'good'            : 2,
            // }
        },
        plug_type : {
            query_sql:"SELECT plug_type_id as id FROM site_data_log_plug_types WHERE type = ?", 
            insert_sql:"INSERT INTO site_data_log_plug_types(type) VALUES (?)", 
            // cached:{
            //     'unknown'   : 1,
            //     'unplugged' : 2,
            //     'usb'       : 3,
            //     'ac'        : 4,
            // }
        },
        tech_type : {
            query_sql:"SELECT tech_type_id as id FROM site_data_log_tech_types WHERE type = ?", 
            insert_sql:"INSERT INTO site_data_log_tech_types(type) VALUES (?)", 
            // cached:{
            //     'li-ion'    : 1
            // }
        }
    },
    $add_connection_log_entry : function(data){
        return this.$get_id_for('connection_type', data.connection, true).then((function(connection_id){
            return this.$exec_query(
                "INSERT INTO site_connection_log(site_id, datetime, connection)\n" +
                "VALUES (?, ?, ?);", [
                this.site_id, data.date, connection_id
            ]);
        }).bind(this)).then(function(results){
            return results && results[0] && results[0].insertId;
        });
    },
    $add_data_log_entry : function(data){
        var plug_id, health_id, tech_id;
        return q().then((function(){
            return this.$get_id_for('plug_type', data.plug_type, false);
        }).bind(this)).then(function(_plug_id){ 
            plug_id = _plug_id;
        }).then((function(){ 
            return this.$get_id_for('health_type', data.health, false);
        }).bind(this)).then(function(_health_id){ 
            health_id = _health_id;
        }).then((function(){ 
            return this.$get_id_for('tech_type', data.bat_tech, true);
        }).bind(this)).then(function(_tech_id){ 
            tech_id = _tech_id;
        }).then((function(){
            return this.$exec_query(
                "INSERT INTO site_data_log(site_id, datetime, power, temp, voltage, battery, status, plug_type, health, bat_tech)\n" +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);", [
                this.site_id, data.date, data.power, data.temp, data.voltage, data.battery, data.status, plug_id, health_id, tech_id
            ]);
        }).bind(this)).then(function(results){
            return results && results[0] && results[0].insertId;
        });
    },    
    $add_event_log_entry : function(data){
        return this.$exec_query(
            "INSERT INTO site_event_log(site_id, datetime, type, message)\n" +
            "VALUES (?, ?, ?, ?);", [
            this.site_id, data.date, data.type, data.message
        ]).then(function(results){
            return results && results[0] && results[0].insertId;
        });
    },
});

function make_stream_pipeline(streams, options){
    var pipeline_err_handler;
    var last_stream = streams[streams.length - 1];
    if(options && options.pipe_errors){
        pipeline_err_handler = function(err){
            last_stream.emit('error', err);
        };
    }
    return streams.reduce(function(_1, _2){
        if(pipeline_err_handler){
            _1.on('error', pipeline_err_handler);
        }
        return _1.pipe(_2);
    });
}

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
                _site_logger = site_logger(site_id, db);
                make_stream_pipeline([
                    logfile.stream, 
                    line_chopper(), 
                    log_entry_parser(),
                    log_entry_to_site_entry_processor(),
                    _site_logger, 
                    dev_null()
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

if(module.id == '.'){
    var config = require('../../config');
    
    var args = process.argv.slice(2);
    var site_id = args.shift() | 0;
    var db;
    
    
    q().then(function(){
        db = mysql.createConnection(config('db'));
        db.connect();
    }).then(function(){
        return process_site_logs(
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