/**
    @module utils/audiotool
*/

var childProcess = require('child_process');


/** Runs sox with the specified arguments, and returns the results in a callback.
     * @method sox
     * @param {Array} args array of parameters to give to sox. (warning!! arguments are not escaped, passing unsecure arguments can lead to security problems.)
     * @param {Object} options options that modify the call.
     * @param {Boolean} options.stderr2stdout wether stderr output should be mixed with stdout ouput.
     * @param {Function} callback function to call when the sox is done, its arguments are (code, stdout_output, stderr_output).
     */
function sox(args, options, callback){
    console.log('sox args:', args.join(', '));
    if(options instanceof Function) { callback = options; }
    options = options || {};

    var cp = childProcess.spawn('sox', args);
    var stdout = {value:""},
        stderr = {value:""};

    if(options.stderr2stdout) {
        stderr = stdout;
    }
    cp.stderr.setEncoding('utf8');
    cp.stderr.on('data', function(data) {
        stderr.value += data;
    });
    cp.stdout.setEncoding('utf8');
    cp.stdout.on('data', function(data) {
        stdout.value += data;
    });

    cp.on('close', function(code){
        console.log('sox exit code:', code);
        console.log('sox stdout:', stdout.value.replace(/\n/g, ' | '));
        console.log('sox stderr:', stderr.value.replace(/\n/g, ' | '));
        callback(code, stdout.value, stderr.value);
    });
}

var audiotools = {

    /** Returns information about a given audio file
     * @method info
     * @param {String} source_path - audio file path
     * @param {Function} callback(code,info) - function to call with the audio info, its arguments are (code, info).
     */
    info: function(source_path, callback){
        var args = ['--info', source_path];
        sox(args, function(code, stdout, stderr){
            // TODO catch error if code !== 0 and verify usage across the app
            var lines = stdout.split('\n');
            var info = {};
            for(var i = 0, e = lines.length; i < e; ++i){
                var m = /^\s*([^:]+?)\s*:\s*(.*)$/.exec(lines[i]);
                const regArtist = /Artist=AudioMoth (\w+)/gmi.exec(lines[i]);
                if (regArtist) info.isUTC = true;
                if (m) {
                    var param = m[1].toLowerCase().replace(/ /g, '_');
                    var value = m[2];
                    switch (param) {
                        case 'input_file'      : value = value.substr(1, value.length-2); break;
                        case 'channels'        :
                        case 'sample_rate'     : value = value | 0; break;
                        case 'precision'       : value = /^(\d+)-bit/.exec(value)[1] | 0; break;
                        case 'duration'        :
                            m = /^(\d+):(\d+):(\d+\.\d+)\s+=\s+(\d+)/.exec(value);
                            value = ( Number(m[1])*60 + Number(m[2]) )*60 + Number(m[3]);
                            info.samples = m[4] | 0;
                        break;
                    }
                    info[param] = value;
                }
            }
            callback(code, info);
        });
    },
    /** Transcodes an audio file using the given parameters.
     * @method transcode
     * @param {String} source_path audio file path
     * @param {String} destination_path output audio file path
     * @param {Object} options transcoding options
     * @param {Object} options.sample_rate set output the sampling rate
     * @param {Object} options.format set the output audio format
     * @param {Object} options.compression set the output compression
     * @param {Object} options.channels set the number of channels in the output
     * @param {Object} options.trim.from start the audio at the specified offset.
     * @param {Object} options.trim.duration clip the autdio to a given duration.
     * @param {Object} options.gain apply gain to the audio file.
     * @param {Object} options.filter apply a frequency filter to the audio file.
     * @param {Object} options.filter.max maximum frequency to allow.
     * @param {Object} options.filter.min minimum frequency to allow.
     * @param {Object} options.filter.type one of ['default', 'sinc'].
     * @param {Function} callback function to call with the results.
     */
    transcode : function(source_path, destination_path, options, callback){
        if(options instanceof Function) { callback = options; }
        options = options || {};

        var args = [];
        args.push('--magic', '--show-progress');
        args.push(source_path);
        if (options.sample_rate) {
            args.push('-r', options.sample_rate | 0);
        }
        if (options.format) {
            args.push('-t', options.format);
        }
        if (options.compression) {
            args.push('-C', options.compression | 0);
        }
        if (options.channels) {
            args.push('-c', options.channels | 0);
        }

        args.push(destination_path);

        if (options.gain) {
            args.push('gain', options.gain | 0);
        }

        if (options.filter && (options.filter.min || options.filter.max)) {
            var fmin=options.filter.min|0, fmax=options.filter.max|0;
            switch(options.filter.type){
                case 'sinc':
                    args.push('sinc', (fmin || '')+(fmax ? ('-'+fmax) : '') );
                break;
                default:
                    if(fmax){
                        if(fmin){
                            var fc=((fmax+fmin)/2)|0, fw=((fmax-fmin)/2)|0;
                            args.push('bandpass', fc, fw);
                        } else {
                            args.push('lowpass', fmax);
                        }
                    } else if(fmin){
                        args.push('highpass', fmin);
                    }
                break;
            }
        }

        if (options.trim) {
            args.push('trim', +options.trim.from, +options.trim.duration);
        }

        sox(args, {}, callback);
    },
    /** Generates a spectrogram of a given audio file.
     * @method spectrogram
     * @param {String} source_path path to the source audio file.
     * @param {String} destination_path output path of the spectrogram.
     * @param {Object} options (optional) set of options.
     * @param {Integer} options.maxfreq maximum frequency to show in the spectrogram. (optional)
     * @param {Integer} options.height spectrogram's image height. (default: 256)
     * @param {Integer} options.width spectrogram's image height. (optional, ignored if not set)
     * @param {Integer} options.pixPerSec scale used to compute the spectrogram's width in terms
     *                  of the audio file's duration. (default: 172)
     * @param {Integer} options.quantization number of colors gradations used in the spectrogram image.
     *                  (default: 249, the maximum)
     * @param {Integer} options.contrast the ‘contrast’ of the spectrogram display.
     * @param {String} options.window windowing function used to compute the spectrogram.
     *                 (One of 'Hann', 'Hamming', 'Bartlett', 'Rectangular', 'Kaiser', default: 'Hann')
     * @param {Function} callback callback function.
     */
    spectrogram : function(source_path, destination_path, options, callback){
        if(options instanceof Function) { callback = options; }
        options = options || {};
        var args = [];
        args.push(source_path);
        args.push('-n');
        args.push('remix', '-'); // 'remix -' performs a mix-down of all input channels to mono
        if(options.maxfreq) {
            args.push('rate', (options.maxfreq/2)|0); // maximum frequency to show in spectrogram
        }
        args.push('spectrogram');             // sox spectrogram filter
        args.push('-r',                             // output just the raw spectrogram image (no axes, no nothing)
            '-y', ((options.height    | 0) || 256)  // set the spectrogram's height
        );
        if(options.width) {
            args.push(
                '-x', (options.width | 0) // set the spectrogram's width
            );
        } else {
            args.push(
                '-X', ((options.pixPerSec | 0) || 172) // set the spectrogram's pixels/second
            );
        }
        args.push(
            '-q', ((options.quantization | 0) || 249) // color quantization
        );
        if(options.contrast) {
            args.push('-z', options.contrast);
        }
        if(options.window && ['Hann', 'Hamming', 'Bartlett', 'Rectangular', 'Kaiser'].indexOf(options.window) >= 0) {
            args.push('-w', options.window); // just the raw spectrogram image
        }
        if (!options.isColored) {
            args.push('-lm');
        }
        args.push('-o', destination_path);
        sox(args, {}, callback);
    }
};

module.exports = audiotools;
