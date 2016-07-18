var q = require('q');
var async = require('async');

/** Scheduler that processes items in order.
 */
function JobScheduler(options){
    this.running = false;
    options = options || {};
    this.process = options.process;
    if(options.onError){
        this.onError = options.onError;
    }
    this.fetch = options.fetch;
    this.drain = options.drain;
    this.queue = [];
}

JobScheduler.prototype = {
    /** Pushes an job item into the scheduler.
     * @param {Object} jobItem - item representiong the job.
     */
    push: function(jobItem){
        this.queue.push(jobItem);
        this.run();
    },

    /** Runs the scheduler if not running, otherwise it is a no-op.
     */
    run: function(){
        if(this.running){
            return;
        }

        this.running = true;
        return q.Promise((function(resolve, reject){
            async.doWhilst((function(nextStep){
                this.oneRunIteration().then(function(){
                    nextStep();
                }, function(err){
                    nextStep(err);
                });
            }).bind(this), (function(){
                return this.queue.length;
            }).bind(this), (function(err){
                this.running = false;
                if(err){
                    reject(err);
                } else {
                    resolve();
                }
            }).bind(this));
        }).bind(this)).then((function(){
            if(this.drain){
                return this.drain(this);
            }
        }).bind(this));
    },

    /** runs one iteration of the scheduling loop.
     */
    oneRunIteration: function(){
        return q().then((function(){
            if(!this.queue.length){
                return this._fillQueue();
            }
        }).bind(this)).then((function(){
            if(this.queue.length){
                return q(this.queue.shift()).then((function(jobItem){
                    if(jobItem && this.process){
                        return this.process(jobItem);
                    }
                }).bind(this)).catch((function(error){
                    return this.onError(error);
                }).bind(this));
            }
        }).bind(this)).then((function(){
            if(!this.queue.length){
                return this._fillQueue();
            }
        }).bind(this));
    },

    /** Called whenever a processing error occurs.
     * @param {Object} error - error object
     */
    onError: function(error){
        console.log(error);
    },

    /** Fills the queue automatically.
     * @param {Object} error - error object
     */
    _fillQueue: function(){
        return q(this.fetch).then((function(fetch){
            if(fetch){
                return fetch(this.queue);
            }
        }).bind(this));
    }
};


module.exports = JobScheduler;
