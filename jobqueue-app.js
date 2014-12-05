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
        next();
    },
    function(next){
        async.forever(function main_loop(next_iteration){
            var jobs_to_enqueue=0;
            async.waterfall([
                job_queue.hearbeat.bind(job_queue),
                function count_enqueued_jobs(){
                    var next_step = arguments[arguments.length-1];
                    job_queue.count_jobs(next_step);
                },
                function enqueue_more_jobs(job_count){
                    var next_step = arguments[arguments.length-1];
                    jobs_to_enqueue = Math.max(0, job_queue.get_cpu_count(config("job-queue").concurrency) - job_count);
                    async.whilst(
                        function(){
                            return jobs_to_enqueue > 0;
                        },
                        function(next_jte_loop){
                            --jobs_to_enqueue;
                            async.waterfall([
                                function get_one_enqueued_job(){
                                    var next_w2_step = arguments[arguments.length-1];
                                    job_queue.enqueue_one_waiting_job(next_w2_step);
                                },
                                function run_enqueued_job(job){
                                    var next_w2_step = arguments[arguments.length-1];
                                    run_job(job, next_w2_step);
                                }
                            ], next_jte_loop);
                        }, 
                        next_step
                    );
                },
                function wait(){
                    var next_step = arguments[arguments.length-1];
                    setTimeout(next_step, config("job-queue").delay);
                }
            ], next_iteration);    
        }, next);
    }
],function on_error(err){
    console.error((new Date()) + ", queue : " + job_queue.id + ",  FATAL ERROR : ", err);
    process.exit(1);
})
