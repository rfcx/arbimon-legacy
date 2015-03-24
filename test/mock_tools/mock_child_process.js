var events={
    on : function(event, callback){
        var l = this.listeners || (this.listeners={});
        var a = l[event] || (l[event]=[]);
        a.push(callback);
    },
    send: function(/*event, ...*/){
        var args=Array.prototype.slice.apply(arguments);
        event = args.shift();
        var l = this.listeners, a=l&&l[event];
        if(a){
            setImmediate(function(){
                a.forEach(function(cb){
                    cb.apply(null, args);
                });
            });
        }
    }
};

var mock_process = function(command, args, options, callback){
    this.command = command;
    this.args = args;
    this.options = options;
    this.stdin = new mock_pipe();
    this.stdout = new mock_pipe();
    this.stderr = new mock_pipe();
    if(callback){
        var data={stdout:'', stderr:''};
        this.stdout.on('data', function(data){ data.stdout += data; });
        this.stderr.on('data', function(data){ data.stderr += data; });
        this.on('close', function(code){
            if(code){
                var err = new Error();
                err.code = code;
                callback(err);
            } else {
                callback(null, new Buffer(data.stdout), new Buffer(data.stderr));
            }
        });
    }
    this.callback = callback;
};

mock_process.prototype={
    on:events.on,
    send:events.send    
};

var mock_pipe = function(){};

mock_pipe.prototype={
    on:events.on,
    send:events.send,
    setEncoding: function(encoding){
        this.encoding = encoding;
    }
};

var mock_child_process = {
    running:[],
    spawn: function(command, args, options){
        var proc = new mock_process(command, args, options);
        this.running.push(proc);
        return proc;
    },
    exec: function(command, options, callback){
        if(options instanceof Function && callback === undefined){
            callback = options;
            options = undefined;
        }
        var proc = new mock_process(command, [], options, callback);
        this.running.push(proc);
    },
    types: {
        process: mock_process,
        pipe: mock_pipe
    }
};

module.exports = mock_child_process;
