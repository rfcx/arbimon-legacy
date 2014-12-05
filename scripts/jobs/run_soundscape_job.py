#! 

function get_job_id(_job_id){
    var next = arguments[arguments.length -1];
    job_id = _job_id;
    next();
},
function push_job_to_queue(row){
    var next = arguments[arguments.length -1];
    jobQueue.push({
        name: 'soundscapeJob'+job_id,
        work: function(callback){
            var cmd = __dirname+'/../../.env/bin/python', args = [
                scriptsFolder+'Soundscapes/playlist2soundscape.py' ,
                cmd_escape(job_id           ), cmd_escape(params.playlist ),
                cmd_escape(params.maxhertz  ), cmd_escape(params.bin      ), cmd_escape(params.aggregation),
                cmd_escape(params.threshold ), cmd_escape(params.project  ), cmd_escape(params.user       ),
                cmd_escape(params.name      ), cmd_escape(params.frequency)
            ];
            var python = require('child_process').spawn(cmd, args);
            var output = "";
            python.stdout.on('data', function(data){ 
                output += data
            });
            python.on('close', function(code){ 
                if (code !== 0) { 
                    debug('soundscapeJob '+job_id+' returned error ' + code);
                    debug('cmd : ' + cmd);
                    debug('args  : ' + args);
                } else {
                    debug('no error, everything ok, soundscapeJob completed ',job_id);
                }
                callback();
            });
        }
    },
    1,
    function() {
        debug("job done! soundscapeJob:", job_id);
    });
    next();
}
