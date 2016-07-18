var debug = require('debug')('arbimon2:monkey');
var AWS = require('aws-sdk');
var request = require('request');

var config = require('../config');

var ec2 = new AWS.EC2();

var poke = function(argument) {
    request.post(config('hosts').jobqueue + '/notify', function(){});
};

var spank = function function_name(params) {
    ec2.startInstances(params, function(err, data) {
        if (err) return console.error(err, err.stack);
        
        debug('startInstance', data.StartingInstances[0]); 
    });
};

var pokeDaMonkey = function(){
    
    if(process.env.NODE_ENV !== "production") {
        return poke();
    }
    
    var params = {
        InstanceIds: [config('job-queue').instanceId]
    };
    
    ec2.describeInstances(params, function(err, data) {
        if(err) return console.error(err, err.stack);
        
        var instanceState = data.Reservations[0].Instances[0].State;
        
        debug('instanceState', instanceState);
        
        switch(instanceState.Name)  {
            case 'running':
                // notify new job
                return poke();
            case 'stopped':
                //start
                spank(params);
                break;
                
            case 'stopping':
                // wait for stop then start
                ec2.waitFor('instanceStopped', params, function(err, data) {
                    if(err) return console.error(err, err.stack); 
                    
                    spank(params);
                });
                break;
                
            case 'pending':
                //do nothing jobqueue will read the job when finish booting
                break;
                
            default:
                //for shutting-down and terminated states do nothing
                // as those state only happen with maintenance by an admin
                break;
        }
    });
};

module.exports = pokeDaMonkey;
