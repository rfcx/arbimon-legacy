var debug = require('debug')('arbimon2:monkey');
var AWS = require('aws-sdk');
var q = require('q');
var request = require('request');

var config = require('../config');

var ec2 = new AWS.EC2();

const instanceId = config('job-queue').instanceId;
const jobQueueIsEC2Instance = instanceId !== 'none';

function poke(argument) {
    return q.ninvoke(request, 'post', config('hosts').jobqueue + '/notify');
}

function spank(params) {
    return q.ninvoke(ec2, 'startInstances', params).then(function(data) {
        debug('startInstance', data.StartingInstances[0]); 
    });
}

function pokeDaMonkey(){
    if(process.env.NODE_ENV != "production"){
        return poke();
    }
    
    var params = {
        InstanceIds: [instanceId]
    };
    
    return q.ninvoke(ec2, 'describeInstances', params).then(function(data) {
        var instanceState = data.Reservations[0].Instances[0].State;
        
        debug('instanceState', instanceState);
        
        switch(instanceState.Name)  {
            case 'running':
                // notify new job
                return poke();
            case 'stopped':
                //start
                return spank(params);
            case 'stopping':
                // wait for stop then start
                return q.ninvoke(ec2, 'waitFor', 'instanceStopped', params).then(function() {
                    return spank(params);
                });                
            case 'pending':
                // do nothing jobqueue will read the job when finish booting
            break;                
            default:
                // for shutting-down and terminated states do nothing
                // as those states only happen with maintenance by an admin
            break;
        }
    }).catch(function(err){
        console.error(err, err.stack);
    });
}

module.exports = jobQueueIsEC2Instance ? pokeDaMonkey : () => { };
