var q = require('q');

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
console.log("run :: run: function(){");
        if(this.running){
console.log("run :: if(this.running){");
            return;
        }
        
        this.running = true;
        return this.oneRunIteration().catch((function(error){
console.log("run :: return this.oneRunIteration().catch((function(error){");
            return this.onError(error);
        }).bind(this)).finally(function(){
console.log("run :: }).bind(this)).finally(function(){");
            this.running=false;
        }).then((function(){
console.log("run :: }).then((function(){");
            if(this.drain){
console.log("run :: if(this.drain){");
                return this.drain(this);
            }
        }).bind(this));
    },
    
    /** runs one iteration of the scheduling loop.
     */
    oneRunIteration: function(){
        return q().then((function(){
console.log("oneRunIteration :: return q().then((function(){");
            if(!this.queue.length){
console.log("oneRunIteration :: if(!this.queue.length){");
                return this._fillQueue();
            }
        }).bind(this)).then((function(){
console.log("oneRunIteration :: }).bind(this)).then((function(){");
            if(this.queue.length){
console.log("oneRunIteration :: if(this.queue.length){");
                return q(this.queue.shift()).then((function(jobItem){
console.log("oneRunIteration :: return q(this.queue.shift()).then((function(jobItem){");
                    if(jobItem && this.process){
console.log("oneRunIteration :: if(jobItem && this.process){");
                        return this.process(jobItem);
                    }
                }).bind(this)).catch((function(error){
console.log("oneRunIteration :: }).bind(this)).catch((function(error){");
                    return this.onError(error);
                }).bind(this)).then((function(){
console.log("oneRunIteration :: }).bind(this)).then((function(){");
                    return this.oneRunIteration();
                }).bind(this));
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