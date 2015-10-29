var stream = require('stream');

/** Makes a stream-making function.
 * @param {Object} stream_args - parameters to pass to stream constructor.
 * @param {Object} options - options defining the stream maker function.
 * @param {Function/String} options.type - Type of stream to build. optional.
            default type is computed: if options.transform is given, then default 
            type is stream.Transform, else if options.read and options.write are 
            given,  it's stream.Duplex, else if only options.read is given, it's 
            stream.Readable, else if only options.write is given, it's 
            stream.Writable.
 * @param {Function} options.initialize - function to initialize the stream based 
 *          on given parameters.
 * @param {Function} options.transform - function managing the stream's input to 
 *          output transformation. optional.
 * @param {Function} options.flush - function managing the stream's flush requests. optional.
 * @param {Function} options.read - function managing the stream's input. optional.
 * @param {Function} options.write - function managing the stream's output. optional.
 * @param {Any} options.$* - gets set as a stream attribute.
 */
function make_stream_fn(stream_args, options){
    var stream_type;
    var constructor;
    var attribs=[];
    
    if(options === undefined && stream_args){
        options = stream_args;
        stream_args = undefined;
    }
    
    if(options.type){
        stream_type = (options.type instanceof Function) ? options.type : stream[options.type];
        delete options.type;
    }

    if(options.initialize){
        constructor = options.initialize;
        delete options.initialize;
    }

    if(!stream_type){
        stream_type = options.transform ? stream.Transform : (
            options.read ? (
                options.write ? stream.Duplex : stream.Readable
            ) : (
            options.write ? stream.Writable : undefined
        ));
    }
    
    for(var o in options){
        if(/transform|flush|read|write/.test(o)){
            attribs.push(['_' + o, options[o]]);
        } else if(/^\$/.test(o)){
            attribs.push([o, options[o]]);
        }
    }

    var fn = function(){
        var _stream = new stream_type(stream_args);
        attribs.forEach(function(a){
            _stream[a[0]] = a[1];
        });
        if(constructor){
            constructor.apply(_stream, Array.prototype.slice.call(arguments));
        }
        return _stream;
    };
    return fn;
}

/** Returns a transform stream that chops its input into string lines.
 * @return {stream.Transform} that reads an input buffer, and outputs string objects of the lines in the buffer.
 */
var line_chopper = make_stream_fn({objectMode:true}, {
    $lastLineData:'',
    transform: function (chunk, encoding, done) {
        var data = chunk.toString();
        if(this.$lastLineData){
            data = this.$lastLineData + data;
        }
        
        var lines = data.split('\n');
        this.$lastLineData = lines.splice(lines.length-1,1)[0];
        lines.forEach(this.push.bind(this));
        done();
    },
    flush: function (done) {
        if(this.$lastLineData){ 
            this.push(this.$lastLineData);
        }
        this.$lastLineData = null;
        done();
    }
});

/** Returns a write stream that just consumes the stream.
 * @return {stream.Writable} that just consumes the stream.
 */
var dev_null = make_stream_fn({objectMode:true}, {
    write: function (line, encoding, done) {
        done();
    }
});

/** Creates a stream pipeline.
 * @param {Array} streams - array of streams to pipe
 * @param {Object} options - options for modifying the pipeline.
 * @param {Boolean} options.pipe_errors - if true, errors in any stream of the pipeline are re-emited at the end of the pipeline.
 * @return {stream} final end of the pipeline.
 */
function make_stream_pipeline(streams, options){
    var pipeline_err_handler;
    var last_stream = streams[streams.length - 1];
    if(options && options.pipe_errors){
        pipeline_err_handler = function(err){
            last_stream.emit('error', err);
        };
    }
    return streams.reduce(function(_1, _2){
        if(pipeline_err_handler){
            _1.on('error', pipeline_err_handler);
        }
        return _1.pipe(_2);
    });
}


module.exports = {
    make_stream_fn : make_stream_fn,
    make_stream_pipeline : make_stream_pipeline,
    line_chopper : line_chopper,
    dev_null : dev_null,
};