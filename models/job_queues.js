var mysql = require('mysql');
var async = require('async');
var validator = require('validator');
var dbpool = require('../utils/dbpool');
var sqlutil = require('../utils/sqlutil');
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
        "    pid, host, platform, arch, cpus, freemem, heartbeat \n"+
        ") VALUES (\n    " + mysql.escape([
            pid, host, cpus, freemem
        ]) + ", NOW()\n)", function(err, result){
        if(err){ callback(err); return; }
        new JobQueue(result.insertId, callback);
    });
};

JobQueue.find = function(id, callback) {
    queryHandler(
        "SELECT job_queue_id as id, pid, host, platform, arch, cpus, hearbeat \n" +
        "FROM `job_queues` \n"+
        "WHERE job_queue_id = " + mysql.escape(id), callback);
},


JobQueue.prototype = {
    heartbeat: function(callback) {
        queryHandler(
            "UPDATE `job_queues` \n"+
            "SET freemem = " + os.freemem() + ", \n"+
            "    heartbeat = NOW() \n" +
            "WHERE job_queue_id = " + (this.id | 0), 
        callback);
    },

    enqueue_one_waiting_job: function(job_queue, count, callback) {
        var job_queue_id = this.id | 0;
        var job_id, jobs_to_check = true;
        async.doWhilst(
            function (){
                return jobs_to_check && !job_id;
            },
            function(next_loop){
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
                            "WHERE J.state = 'waiting' AND J.job_id = " + job_id + "\n" +
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
                            "SELECT J.job_id as id\n"+
                            "FROM job_queue_enqueued_jobs JQEJ \n" +
                            "WHERE JQEJ.job_queue_id = "+job_queue_id+" AND J.job_id = "+job_id+"\n" +
                        next);
                    },
                    function fetch_job_id_if_still_associated_else_nothing(jobs){
                        var next = arguments[arguments.length-1];
                        job_id = jobs.length ? jobs[0].id : null;
                        next();
                    },
                ], next_loop);
            }, 
            function(err){
                if(err){
                    callback(err);
                } else if(job_id){
                    Jobs.find({id:job_id}, {unpack_single:true, compute:'script_path'}, callback);
                } else {
                    callback();
                }                
            }
        );
    },

    count_jobs : function(callback){
        queryHandler(
            "SELECT count(*) as count\n" +
            "FROM `job_queue_enqueued_jobs` \n"+
            "WHERE job_queue_id = " + (this.id | 0),
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
