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

var mock_process = function(command, args, options){
    this.command = command;
    this.args = args;
    this.options = options;
    this.stdin = new mock_pipe();
    this.stdout = new mock_pipe();
    this.stderr = new mock_pipe();
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
    types: {
        process: mock_process,
        pipe: mock_pipe
    }
};

module.exports = mock_child_process;
