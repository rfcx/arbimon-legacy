var async = require('async');

var jobQueueInstance = async.priorityQueue(function (task, callback) {
    console.log('starting task ' + task.name);
    callback();
}, os.cpus().length);


jobQueueInstance.drain = function() {
    console.log('all items have been processed');
}

module.exports = jobQueueInstance;
