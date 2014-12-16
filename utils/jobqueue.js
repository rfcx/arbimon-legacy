var debug = require('debug')('arbimon2:jobqueue');
var async = require('async');
var os    = require('os');



var jobQueueInstance = async.priorityQueue(function (task, callback) {
    console.log('starting task ' + task.name);
    task.work(callback);
}, os.cpus().length);


jobQueueInstance.drain = function() {
    console.log('all items have been processed');
};

module.exports = jobQueueInstance;
