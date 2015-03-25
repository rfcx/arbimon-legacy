// var debug = console.log;
var async = require('async');

var mock_ec2 = function(){
    this.instance_cache={};
};

mock_ec2.prototype = {
    startInstances: function(params, callback){
        // debug("startInstances", params);
        var i, e;
        var instances = [], self=this;
        var results={StartingInstances:[{Instances:instances}]};
        var iids = params.InstanceIds;
        if(!iids || !iids.length){
            for(i in this.instance_cache){
                iids.push(i);
            }
        }
        
        async.eachSeries(iids, (function(iid, next){
            var instance = this.instance_cache[iid];
            if(instance){
                if(instance['!cannot_start']){
                    next(new Error("Cant start instance " + params.InstanceIds[i] + "."));
                } else {
                    this.__setInstance(instance.InstanceId, 'pending');
                    this.__setInstance(instance.InstanceId, 'running');
                    instances.push(instance);
                    next();
                }
            } else {
                // debug("Cant find instance ",iid," in cache.");
                next(new Error("Cant find instance " + iid + " in cache."));
            }
        }).bind(this), function(err){
            if(err){
                callback(err);
            } else {
                callback(null, results);
            }
        });
    },
    describeInstances: function(params, callback){
        var i, e;
        var instances = [];
        var results={Reservations:[{Instances:instances}]};
        if(params.InstanceIds && params.InstanceIds.length > 0){
            for(i=0, e=params.InstanceIds.length; i < e; ++i){
                var instance = this.instance_cache[params.InstanceIds[i]];
                if(instance){
                    instances.push(instance);
                } else {
                    callback(new Error("Cant find instance " + params.InstanceIds[i] + " in cache."));
                    return;
                }
            }
        } else {
            for(i in this.instance_cache){
                instances.push(this.instance_cache[i]);
            }
        }
        
        if(instances.length > 0){
            callback(null, results);
        } else {
            callback(new Error("No instances to describe."));
        }
    },
    
    waitFor: function(event, params, cb){
        if(params instanceof Function && cb === undefined){
            cb = params;
            params = undefined;
        }
        var insts = (params && params.InstanceIds) || 'any';
        if(!(insts instanceof Array)){
            insts = [insts];
        }
        if(!this.__listeners){
            this.__listeners = {};
        }
        var l=this.__listeners;
        insts.forEach(function(inst){
            if(!l[inst]){
                l[inst] = {};
            }
            var li = l[inst];
            if(!li[event]){
                li[event] = [];
            }
            li[event].push(cb);
        });
    },
    __send: function(event, instance){
        var data = Array.prototype.slice.call(arguments, 2);
        var le1=((this.__listeners && this.__listeners[instance]) || {})[event] || [];
        var le2=((this.__listeners && this.__listeners.any) || {})[event] || [];
        // debug(":: evt :: ", event, instance, "("+le1.length+", any:"+le2.length+")", data);
        if(le1  || le2){
            setImmediate(function(){
                if(le1){
                    le1.forEach(function(cb){
                        if(cb){ cb.apply(null, data); }
                    });
                }
                if(le2){
                    le2.forEach(function(cb){
                        if(cb){ cb.apply(null, data); }
                    });
                }
            });
        }
    },
    __setInstance: function(id, state, data){
        var instance = this.instance_cache[id] || {InstanceId: id};
        var oldstate = instance.State && instance.State.Name;
        if(data){
            for(var d in data){
                instance[d] = data[d];
            }
        }
        var event = 'instance' + state.replace(/(^.)|-(.)/g, function(_0, _1, _2){return (_1 || _2).toUpperCase();});
        if(instance['!cannot_be_'+state]){
            this.__send(event, [id], new Error("Instance cannot be in state " + state));
        } else {
            instance.State = this.states[state];
            this.instance_cache[id] = instance;
            if(oldstate != state){
                this.__send(event, [id]);
            }
        }
    },
    states:{
        'pending'       : {Code:0 , Name:'pending'      },
        'running'       : {Code:16, Name:'running'      },
        'shutting-down' : {Code:32, Name:'shutting-down'},
        'terminated'    : {Code:48, Name:'terminated'   },
        'stopping'      : {Code:64, Name:'stopping'     },
        'stopped'       : {Code:80, Name:'stopped'      }
    }
};


module.exports = mock_ec2;
