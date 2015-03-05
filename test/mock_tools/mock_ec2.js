var mock_ec2 = function(){
    this.instance_cache={};
};

mock_ec2.prototype = {
    startInstances: function(params, callback){
        var i, e;
        var instances = [], self=this;
        var results={StartingInstances:[{Instances:instances}]};
        if(params.InstanceIds && params.InstanceIds.length > 0){
            for(i=0, e=params.InstanceIds.length; i < e; ++i){
                var instance = this.instance_cache[params.InstanceIds[i]];
                if(instance){
                    instance.State = this.states.pending;
                    this.__send('instanceStarting', instance);
                    setTimeout(function(){
                        instance.State = self.states.running;
                        self.__send('instanceStarted', instance);
                    }, 1);
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
        }
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
        var l=this.__listeners || (this.__listeners={});
        var insts = (params && params.InstanceIds) || 'any';
        if(!(insts instanceof Array)){
            insts = [insts];
        }
        insts.forEach(function(inst){
            var li=l[event] || (l[event]={});
            var le=li[event] || (li[event]=[]);
            le.push(cb);
        });
    },
    __send: function(event, instance){
        var data = Array.prototype.slice.call(arguments, 2);
        var le=this.__listeners && this.__listeners[event];
        le = le;
        if(le){
            setImmediate(function(){
                if(le[instance]){
                    le[instance].forEach(function(cb){
                        if(cb){ cb.apply(null, data); }
                    });
                }
                if(le.any){
                    le.any.forEach(function(cb){
                        if(cb){ cb.apply(null, data); }
                    });
                }
            });
        }
    },
    __setInstance: function(id, state){
        var instance = {InstanceId: id, State:this.states[state]};
        this.instance_cache[id] = instance;
        this.__send('instance' + state.replace(/(^.)|-(.)/g, function(_0, _1, _2){return (_1 || _2).toUpperCase();}), [instance]);
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
