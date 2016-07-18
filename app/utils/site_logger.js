var mysql = require('mysql');
var q = require('q');
var streaming = require('./streaming');


/** Returns a stream that adds site log entries to a given site's log and returns the entry ids.
* @return {stream.Transform} stream that adds site log entries to a given site's log and returns the entry ids.
*/
var site_logger = streaming.make_stream_fn({objectMode:true}, {
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
        // sql = data ? mysql.format(sql, data) : sql;
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


module.exports = {
    site_logger : site_logger
};