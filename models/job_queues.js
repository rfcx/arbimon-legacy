var os  = require('os');
var mysql = require('mysql');
var async = require('async');
var validator = require('validator');
var dbpool = require('../utils/dbpool');
var sqlutil = require('../utils/sqlutil');
var debug    = require('debug')('arbimon2:model:jobqueues');
var Jobs = require('./jobs');
var arrays_util  = require('../utils/arrays');


var queryHandler = dbpool.queryHandler;

var JobQueue = function(id, callback){
    if(id){
        JobQueue.find(id, (function(err, data){
            if(err){ 
                callback(err); 
            } else if(!data.length){ 
                callback(new Error("JobQueue of id "+id+" not found."));
            } else {
                data = data[0];
                for(var i in data){
                    this[i] = data[i];
                }
                callback(null, this);
            }
        }).bind(this));
    }
};

JobQueue.new = function(callback) {
    var pid  = process.pid;
    var host = os.hostname();
    var cpus = os.cpus().length;
    var platform = os.platform();
    var arch     = os.arch()    ;
    var freemem  = os.freemem();
    queryHandler(
        "INSERT INTO `job_queues` (\n"+
        "    pid, host, platform, arch, cpus, freemem, heartbeat, is_alive \n"+
        ") VALUES (\n    " + mysql.escape([
            pid, host, platform, arch, cpus, freemem
        ]) + ", NOW(), 1\n)", function(err, result){
        if(err){ callback(err); return; }
        debug("New JobQueue created. Id : %s", result.insertId);
        new JobQueue(result.insertId, callback);
    });
};

JobQueue.find = function(id, callback) {
    queryHandler(
        "SELECT job_queue_id as id, pid, host, platform, arch, cpus, heartbeat, is_alive as alive \n" +
        "FROM `job_queues` \n"+
        "WHERE job_queue_id = " + mysql.escape(id), callback);
};

/** Cleans up after job queues that have become unresponsive.
 *  @param {Integer}  qtimeout timeout after wich job queues are considered inactive and dead.
 *  @param {Integer}  jtimeout timeout after wich jobs are considered stalled.
 *  @param {Function} callback(err, ...) called back after the aciton is done. 
 *                          cleaned_up is the number of job queues that were cleaned up.
 **/
JobQueue.cleanup_stuck_queues = function(qtimeout, jtimeout, callback){
    qtimeout = qtimeout ||  300000;
    jtimeout = jtimeout || 1800000;

    async.waterfall([
        function kill_unresponsive_job_queues(next){
            queryHandler(
                "UPDATE `job_queues` \n"+
                "SET is_alive = 0 \n" +
                "WHERE heartbeat < DATE_SUB(NOW(), INTERVAL "+(qtimeout/1000.0)+" SECOND) \n" + 
                "  AND is_alive = 1", 
            next);
        },
        function dequeue_initializing_jobs_from_dead_queues(){
            var next = arguments[arguments.length-1];
            queryHandler(
                "UPDATE `jobs` J \n" +
                "  JOIN `job_queue_enqueued_jobs` EJ ON J.job_id = EJ.job_id \n"+
                "  JOIN `job_queues` JQ ON JQ.job_queue_id = EJ.job_queue_id \n"+
                "SET J.state = 'waiting', \n" +
                "    J.last_update = NOW() \n" +
                "WHERE J.state='initializing' \n"+
                "  AND J.last_update < DATE_SUB(NOW(), INTERVAL "+(qtimeout/1000.0)+" SECOND) \n" + 
                "  AND JQ.is_alive = 0", 
            next);
        },
        function cleanup_dead_jobs(){
            var next = arguments[arguments.length-1];
            queryHandler(
                "UPDATE `jobs` J \n" +
                "  JOIN `job_queue_enqueued_jobs` EJ ON J.job_id = EJ.job_id \n"+
                "  JOIN `job_queues` JQ ON JQ.job_queue_id = EJ.job_queue_id \n"+
                "SET J.state = 'stalled', \n" +
                "    J.last_update = NOW() \n" +
                "WHERE J.state='processing' \n"+
                "  AND J.last_update < DATE_SUB(NOW(), INTERVAL "+(jtimeout/1000.0)+" SECOND) \n" + 
                "  AND JQ.is_alive = 0", 
            next);
        }
    ], callback);
};


JobQueue.prototype = {
    /** Sends a heartbeat to the database.
     * @callback {Function} callback(err) called back after the action is done.
     **/
    send_heartbeat: function(callback) {
        queryHandler(
            "UPDATE `job_queues` \n"+
            "SET freemem = " + os.freemem() + ", \n"+
            "    heartbeat = NOW() \n" +
            "WHERE job_queue_id = " + (this.id | 0) + " \n" +
            "  AND is_alive = 1", function(err, result){
            this.alive = !!(result && result.affectedRows);
            if(err){ 
                callback(err); 
            } else if (!this.alive){ 
                callback(new Error("Hearbeat sent, but with no effect. I must have been declared dead.")); 
            } else {
                callback(); 
            }
        });
    },

    /** Enqueues one job into the jobqueue.
     * @callback {Function} callback called back after the heartbeat is sent. 
     **/
    enqueue_one_waiting_job: function(callback) {
        if(!this.alive){
            callback(new Error("Can't enqueue jobs, since job queue is marked as not alive."));
        }
        var job_queue_id = this.id | 0;
        var job_id, jobs_to_check = true;
        async.doWhilst(
            function do_waterfall(next_loop){
                async.waterfall([
                    function find_some_waiting_job(next){
                        job_id = null;
                        Jobs.find({state:'waiting', limit:1}, {id_only:true}, next);
                    }, 
                    function associate_job_to_queue(jobs){
                        var next = arguments[arguments.length-1];
                        if(!jobs.length){
                            jobs_to_check = false;
                            next_loop();
                            return;
                        }
                        
                        job_id = jobs[0].id;
                        
                        queryHandler(
                            "INSERT INTO `job_queue_enqueued_jobs` (job_queue_id, job_id, timestamp)\n"+
                            "SELECT " + job_queue_id + ", J.job_id, NOW() \n"+
                            "FROM jobs J \n" +
                            "JOIN job_types JT ON JT.job_type_id = J.job_type_id \n" +
                            "WHERE J.state = 'waiting' AND J.job_id = " + job_id + " AND JT.enabled = 1\n" +
                            "LIMIT 1 \n" +
                            "ON DUPLICATE KEY UPDATE job_queue_id = " + job_queue_id, 
                        next);
                    },
                    function change_job_state_to_initializing(){
                        var next = arguments[arguments.length-1];
                        Jobs.set_job_state({id:job_id}, 'initializing', next);
                    },
                    function check_job_is_enqueued(){
                        var next = arguments[arguments.length-1];
                        queryHandler(
                            "SELECT JQEJ.job_id as id\n"+
                            "FROM job_queue_enqueued_jobs JQEJ \n" +
                            "WHERE JQEJ.job_queue_id = "+job_queue_id+" \n"+
                            "  AND JQEJ.job_id = "+job_id,
                        next);
                    },
                    function fetch_job_id_if_still_associated_else_nothing(jobs){
                        var next = arguments[arguments.length-1];
                        job_id = jobs.length ? jobs[0].id : null;
                        next();
                    },
                ], next_loop);
            },
            function whilst_no_job_and_jobs_to_check(){
                return jobs_to_check && !job_id;
            },
            function(err){
                if(err){
                    callback(err);
                } else if(job_id){
                    Jobs.find({id:job_id}, {unpack_single:true, script:true}, callback);
                } else {
                    callback(null, null);
                }                
            }
        );
    },

    count_enqueued_jobs : function(callback){
        queryHandler(
            "SELECT count(*) as count\n" +
            "FROM `job_queue_enqueued_jobs` EJ\n"+
            "JOIN `jobs` J ON EJ.job_id = J.job_id\n"+
            "WHERE EJ.job_queue_id = " + (this.id | 0) +
            "  AND J.state IN ('initializing', 'ready', 'processing')",
            function(err, data){
                if(err){callback(err); return;}
                callback(null, data.length ? data[0].count : 0);                
            }
        );
    },

    count_waiting_jobs : function(callback){
        queryHandler(
            "SELECT count(*) as count\n" +
            "FROM `jobs` J\n"+
            "JOIN job_types JT ON JT.job_type_id = J.job_type_id \n" +
            "WHERE J.state = 'waiting' AND JT.enabled = 1\n",
            function(err, data){
                if(err){callback(err); return;}
                callback(null, data.length ? data[0].count : 0);
            }
        );
    },
    
    get_cpu_count: function(count){
        if(count === undefined){
            return this.cpus;
        }
        
        var m = /(\/|\*)([-+\d.eE]+)$/.exec('' + count);
        if(m){
            if(m[1] == '/'){
                count = this.cpus / m[2];
            } else if(m[1] == '*'){
                count = this.cpus * m[2];
            }
        }
        
        if(count < 0){
            count = this.cpus - count;
        } else {
            count = count;
        }
        
        return Math.min(Math.max(1, count), this.cpus);        
    },
};


module.exports = JobQueue;
