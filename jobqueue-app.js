// packages
var express       = require('express');
var debug         = require('debug')('arbimon2:jobqueue-app');
var config        = require('./config');
var model         = require('./models');
var async         = require('async');
var os            = require('os');
var path          = require('path');
var child_process = require('child_process');

var script_cwd  = path.resolve(__dirname);
var script_path = path.resolve(__dirname, 'scripts/');


/** Application for running the main queue
 * @param {Object} options
 * @param {Boolean} options.server whether or not to activate the server, (default: true).
 * @param {Integer} options.concurrency maximum number of concurrent jobs.
 * @param {Integer} options.loop_while_more_jobs whether the main loop keeps running while there are still waiting jobs. (default: true)
 * @param {Integer} options.loop_delay delay between each loop iteration in the main loop.
 * @param {Integer} options.rerun_interval interval to wait before re-running the main loop.
 *                  (if 0, then the main loop is not re-run after a timeout)
 */
var jqapp = function(options){
    this.options = options || {};
    if(this.options.server !== false){
        this.setup_server();
    }
    this.setup_job_queue();
};

jqapp.prototype = {
    setup_server: function(){
        var m, server = this.server = express();
        for(var i in this){
            if(this[i] instanceof Function && (m = /^(get|post|all):\/(\/[-+_/\w\d]*)$/.exec(i))){
                server[m[1]](m[2], this[i].bind(this));
            }
        }
        
        server.use(function(req, res, next) { // catch 404
            res.status(404).json({http:404, error:'not-found'});
        });        
        server.use(server.get('env') === 'development' ? // error handler
            function(err, req, res, next) {
                debug("- ERROR : ", err.status, err.message);
                debug(err.stack);
                res.status(err.status || 500);
                res.json({
                    error  : err.message,
                    status : err.status,
                    stack  : err.stack
                });
            } :
            function(err, req, res, next) {
                res.status(err.status || 500);
                res.json({error: err.message});
            }
        );
    },
    setup_job_queue : function(){
        var self = this;
        model.job_queues.new(function(err, job_queue){
            if(err){ self.error = err; return; }
            self.job_queue = job_queue;
            self.state = 'sleeping';
            self.iteration=0;
            self.run_main_loop();
        });        
    },
    
    /** Runs the main job queue loop, for a while, then calls the callback.
     *  If this the loop is already running, then any calls to this will be ignored.
     *
     * @param {Function} callback called when the loop stops running.
     */
    run_main_loop : function(callback){
        if(this.state == 'running-loop' || !this.job_queue){
            return; // return if, for some reason we are already running.
        }
         
        var self = this;
        var loop_while_more_jobs = this.options.loop_while_more_jobs || config("job-queue").loop_while_more_jobs;
        var loop_delay           = this.options.loop_delay           || config("job-queue").loop_delay          ;
        var rerun_interval       = this.options.rerun_interval       || config("job-queue").rerun_interval      ;
        
        if(self.main_loop_timeout){
            clearTimeout(self.main_loop_timeout);
        }
        debug("  Running main loop.");
        self.state = 'running-loop';

        self.running_loop = true;
        this.loop_once(function(err, results){
            if(loop_while_more_jobs && results && results.waiting > 0 && results.current < results.max){
                debug("  There are still %s more jobs waiting and concurrency is %s/%s, looping in %s ms", results.waiting, results.current, results.max, loop_delay);
                self.main_loop_timeout = setTimeout(self.run_main_loop.bind(self), loop_delay);
            } else if(rerun_interval){
                debug("  Suspending main loop for : %s ms", rerun_interval);
                self.main_loop_timeout = setTimeout(self.run_main_loop.bind(self), rerun_interval);
            } else {
                debug("  Suspending main loop.");
            }
            self.state = 'sleeping';
            if(callback){
                if(err){ 
                    callback(err); 
                } else {
                    callback();
                }
            }
        });
    },
    
    /** Runs the main job queue loop for one iteration, then calls the callback.
     * this function should not be called directly, rather run_main_loop should 
     * be called, which controls the execution of this function.
     *
     * @param {Function} callback called when the loop iteration ends.
     */
    loop_once : function(callback){
        ++this.iteration;
        this.last_updated = new Date();
        debug("Queue Loop Iteration #%s.", this.iteration);
        async.waterfall([ 
            this.job_queue.send_heartbeat.bind(this.job_queue),
            this.cleanup_other_queues.bind(this),
            this.enqueue_and_run_jobs.bind(this)
        ], callback);
    },
    
    cleanup_other_queues: function(){
        var qtimeout = this.options.heartbeat_timeout || config("job-queue").heartbeat_timeout;
        var jtimeout = this.options.job_inactivity_timeout || config("job-queue").job_inactivity_timeout;
        var callback = arguments[arguments.length-1];
        model.job_queues.cleanup_stuck_queues(qtimeout, jtimeout, callback);
    },
    
    get_max_concurrency : function(){
        var concurrency = this.options.concurrency || config("job-queue").concurrency;
        return this.job_queue.get_cpu_count(concurrency);        
    },
    
    enqueue_and_run_jobs: function(){
        var self = this;
        var r={};

        var callback = arguments[arguments.length-1];
        async.waterfall([
            self.job_queue.count_enqueued_jobs.bind(self.job_queue),
            function determine_max_concurrency(enqueued_job_count){
                var next_step = arguments[arguments.length-1];
                r.current  = self.enqueued_job_count = enqueued_job_count;
                r.max      = self.max_concurrency = self.get_max_concurrency();
                next_step();
            },
            self.job_queue.count_waiting_jobs.bind(self.job_queue),
            function determine_max_jobs_count(waiting_job_count){
                var next_step = arguments[arguments.length-1];
                r.waiting = self.waiting_job_count = waiting_job_count;
                next_step();
            },
            function determine_jobs_to_enqueue(job_count){
                var next_step = arguments[arguments.length-1];
                r.to_enqueue = self.jobs_to_enqueue = Math.max(0, Math.min(self.waiting_job_count, self.max_concurrency - self.enqueued_job_count));
                debug("  Job Stats : {Waiting:%s, Running:%s, Max-Concurrency:%s, Left-To-Run:%s}", self.waiting_job_count, self.enqueued_job_count, self.max_concurrency, self.jobs_to_enqueue);
                next_step();
            },
            function enqueue_jobs(){
                var next_step = arguments[arguments.length-1];
                var still_have_jobs = true;
                r.enqueued=0;
                async.whilst(
                    function(){
                        return self.jobs_to_enqueue > 0 && still_have_jobs;
                    },
                    function(next_jte_loop){
                        --self.jobs_to_enqueue;
                        async.waterfall([
                            self.job_queue.enqueue_one_waiting_job.bind(self.job_queue),
                            function run_enqueued_job(){
                                var next_w2_step = arguments[arguments.length-1];
                                var job = arguments.length > 1 ? arguments[0] : null;
                                if(job){
                                    ++r.enqueued;
                                    --r.waiting;
                                    self.run_job(job, next_w2_step);
                                } else {
                                    still_have_jobs = false;
                                    next_w2_step();
                                }
                            }
                        ], next_jte_loop);
                    }, 
                    next_step
                );
            },
            function(){
                var next_step = arguments[arguments.length-1];
                next_step(null, r);
            }
        ], callback);
    },

    run_job: function(job, callback){
        var job_script_path = path.join(script_path, job.script);
        debug("Running job %s. cmd : %s %s", job.id, job_script_path, job.id);
        var job_process = child_process.spawn(job_script_path, [job.id], {
            cwd : script_cwd,
            detached : true,
            stdio :'inherit'
        });
        job_process.unref();    
        callback();
    },
    
    get_stats:function(){
        return {
            queue : this.job_queue.id,
            iteration : this.iteration,
            last_updated : this.last_updated,
            state : this.state,
            options : this.options,
            waiting : this.waiting_job_count, 
            last_enqueued : this.enqueued_job_count, 
            max_concurrent : this.max_concurrency
        };
    },
    
    'get://stats' : function(req, res, next){
        res.json(this.get_stats());
    },
    
    'post://notify': function(req, res, next){
        res.json(this.get_stats());
        this.run_main_loop();
    }
};


module.exports = jqapp;
