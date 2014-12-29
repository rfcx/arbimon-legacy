// packages
var config   = require('./config');
var model    = require('./models');
var jobQueue = require('./utils/jobqueue');
var debug    = require('debug')('arbimon2:jobqueue-app');
var async    = require('async');
var os       = require('os');
var path     = require('path');
var child_process = require('child_process');


var script_path = path.resolve(__dirname, 'scripts/');
var job_queue;

var run_job = function(job, callback){
    console.log("Running job : ", job);
    process.exit(1);
    var job_script_path = path.join(script_path, job.script);
    var job_process = child_process.spawn(job_script_path, [job_queue.id, job.id], {
        detached : true
    });
    job_process.unref();    
};

async.waterfall([
    model.job_queues.new,
    function(_job_queue, next){
        job_queue = _job_queue;
        debug("Starting Job Queue #" + job_queue.id);
        next();
    },
    function(next){
        async.forever(function main_loop(next_iteration){
            var job_count, jobs_to_enqueue=0;
            var iteration = 0;
            async.waterfall([
                function(next_step){
                    ++iteration;
                    debug("Queue Loop Iteration #%s.", iteration);
                    next_step();
                }, 
                job_queue.send_heartbeat.bind(job_queue),
                function(){
                    var next_step = arguments[arguments.length-1];
                    model.job_queues.cleanup_stuck_queues(config('job-queue').heartbeat_timeout, next_step);
                },
                function count_enqueued_jobs(){
                    var next_step = arguments[arguments.length-1];
                    job_queue.count_jobs(next_step);
                },
                function(_job_count){
                    var next_step = arguments[arguments.length-1];
                    job_count = _job_count;
                    var max_concurrency = job_queue.get_cpu_count(config("job-queue").concurrency);
                    jobs_to_enqueue = Math.max(0, max_concurrency - job_count);
                    debug("  Job Stats : {Running:%s, Max-Concurrency:%s, Left-To-Run:%s}", job_count, max_concurrency, jobs_to_enqueue);
                    next_step();
                },
                function enqueue_more_jobs(job_count){
                    var next_step = arguments[arguments.length-1];
                    var still_have_jobs = true;
                    async.whilst(
                        function(){
                            return jobs_to_enqueue > 0 && still_have_jobs;
                        },
                        function(next_jte_loop){
                            --jobs_to_enqueue;
                            async.waterfall([
                                function get_one_enqueued_job(){
                                    debug("function get_one_enqueued_job(){");
                                    var next_w2_step = arguments[arguments.length-1];
                                    job_queue.enqueue_one_waiting_job(next_w2_step);
                                },
                                function run_enqueued_job(){
                                    debug("function run_enqueued_job(job){");
                                    var next_w2_step = arguments[arguments.length-1];
                                    var job = arguments.length > 1 ? arguments[0] : null;
                                    if(job){
                                        run_job(job, next_w2_step);
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
                function wait(){
                    var next_step = arguments[arguments.length-1];
                    debug("  Waiting for : %s ms", config("job-queue").delay);
                    setTimeout(next_step, config("job-queue").delay);
                }
            ], next_iteration);    
        }, next);
    }
],function on_error(err){
    debug((new Date()) + (job_queue ? ", queue : " + job_queue.id : '') + ",  FATAL ERROR : ", err);
    process.exit(1);
});
