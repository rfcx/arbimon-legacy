var debug = require('debug')('arbimon2:audiotool');
var childProcess = require('child_process');
var path = require('path');
var sprintf = require("sprintf-js").sprintf;

/**
Options:
−x num
    Change the (maximum) width (X-axis) of the spectrogram from its default value of 800 pixels to a given number between 100 and 200000. See also −X and −d.
−X num
    X-axis pixels/second; the default is auto-calculated to fit the given or known audio duration to the X-axis size, or 100 otherwise. If given in conjunction with −d,
    this option affects the width of the spectrogram; otherwise, it affects the duration of the spectrogram. num can be from 1 (low time resolution) to 5000 (high time
    resolution) and need not be an integer. SoX may make a slight adjustment to the given number for processing quantisation reasons; if so, SoX will report the actual
    number used (viewable when the SoX global option −V is in effect). See also −x and −d.
−y num
    Sets the Y-axis size in pixels (per channel); this is the number of frequency ‘bins’ used in the Fourier analysis that produces the spectrogram. N.B. it can be slow
    to produce the spectrogram if this number is not one more than a power of two (e.g. 129). By default the Y-axis size is chosen automatically (depending on the number
    of channels). See −Y for alternative way of setting spectrogram height.
−Y num
    Sets the target total height of the spectrogram(s). The default value is 550 pixels. Using this option (and by default), SoX will choose a height for individual
    spectrogram channels that is one more than a power of two, so the actual total height may fall short of the given number. However, there is also a minimum height
    per channel so if there are many channels, the number may be exceeded. See −y for alternative way of setting spectrogram height.
−z num
    Z-axis (colour) range in dB, default 120. This sets the dynamic-range of the spectrogram to be −num dBFS to 0 dBFS. Num may range from 20 to 180. Decreasing
    dynamic-range effectively increases the ‘contrast’ of the spectrogram display, and vice versa.
−Z num
    Sets the upper limit of the Z-axis in dBFS. A negative num effectively increases the ‘brightness’ of the spectrogram display, and vice versa.
−q num
    Sets the Z-axis quantisation, i.e. the number of different colours (or intensities) in which to render Z-axis values. A small number (e.g. 4) will give a ‘poster’-like
    effect making it easier to discern magnitude bands of similar level. Small numbers also usually result in small PNG files. The number given specifies the number of
    colours to use inside the Z-axis range; two colours are reserved to represent out-of-range values.
−s
    Allow slack overlapping of DFT windows. This can, in some cases, increase image sharpness and give greater adherence to the −x value, but at the expense of a
    little spectral loss.
−m
    Creates a monochrome spectrogram (the default is colour).
−h
    Selects a high-colour palette - less visually pleasing than the default colour palette, but it may make it easier to differentiate different levels. If this option
    is used in conjunction with −m, the result will be a hybrid monochrome/colour palette.
−p num
    Permute the colours in a colour or hybrid palette. The num parameter, from 1 (the default) to 6, selects the permutation.
 */

var audiotools = {
    /** Runs sox with the specified arguments, and returns the results in a callback.
     * @param {Array} args array of parameters to give to sox. (warning!! arguments are not escaped, passing usecure arguments can lead to security problems.)
     * @param {Object} options options that modify the call.
     * @param {Boolean} options.stderr2stdout wether stderr output should be mixed with stdout ouput.
     * @param {Function} callback function to call when the sox is done, its arguments are (code, stdout_output, stderr_output).
     */
    sox : function(args, options, callback){
        debug('running sox with ', args);
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
            debug('sox ended with code : ', code);
            debug('stdout : \n  >> ', stdout.value.replace(/\n/g, '\n  >> '));
            debug('stderr : \n  >> ', stderr.value.replace(/\n/g, '\n  >> '));
            callback(code, stdout.value, stderr.value);
        });
    },
    // function calls python tyler.py script
    
    tyler : function(rec_id, callback){ // not in use
        debug('running tyler');        
        var cp = childProcess.spawn('.env/bin/python',['scripts/tiles/tyler.py',rec_id]);
        var stdout = {value:""}, stderr = {value:""};

        cp.stderr.setEncoding('utf8');
        cp.stderr.on('data', function(data) {
            stderr.value += data;
        });
        cp.stdout.setEncoding('utf8');
        cp.stdout.on('data', function(data) {
            stdout.value += data;
        });
        
        cp.on('close', function(code){
            debug('tyler ended with code : ', code);
            debug('stdout : \n  >> ', stdout.value.replace(/\n/g, '\n  >> '));
            debug('stderr : \n  >> ', stderr.value.replace(/\n/g, '\n  >> '));
            output = '';
            if (code)
            {
                output = {"error":"error calling tyler"};
            }
            else
            {
                output = JSON.parse(stdout.value);
            }
            callback(code, output, stderr.value);
        });
    },
    /** Returns information about a given audio file
     * @param {String} source_path - audio file path
     * @param {Function} callback(code,info) - function to call with the audio info, its arguments are (code, info).
     */
    info: function(source_path, callback){
        var args = ['--info', source_path];
        audiotools.sox(args, function(code, stdout, stderr){
            var lines = stdout.split('\n');
            var info = {};
            for(var i = 0, e = lines.length; i < e; ++i){
                var m = /^\s*([^:]+?)\s*:\s*(.*)$/.exec(lines[i]);
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
     * @param {String} source_path audio file path
     * @param {String} destination_path output audio file path
     * @param {Object} options transcoding options
     * @param {Object} options.sample_rate set output the sampling rate
     * @param {Object} options.format set the output audio format
     * @param {Object} options.compression set the output compression
     * @param {Object} options.channels set the number of channels in the output
     * @param {Function} callback function to call with the results.
     */    
    transcode : function(source_path, destination_path, options, callback){
        if(options instanceof Function) { callback = options; }
        options = options || {};
        
        var args = [];
        args.push('--guard', '--magic', '--show-progress');
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
        audiotools.sox(args, {}, callback);
    },
    /** Generates a spectrogram of a given audio file.
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
     * @param {String} options.window windowing function used to compute the spectrogram.
     *                 (One of 'Hann', 'Hamming', 'Bartlett', 'Rectangular', 'Kaiser', default: 'Hann')
     * @param {Function} callback callback function.
     */
    spectrogram : function(source_path, destination_path, options, callback){
        if(options instanceof Function) { callback = options; }
        options = options || {};
        
        var args = [];
        args.push(source_path);
        if(options.maxfreq) {
            args.push('-r', ((options.maxfreq/500)|0) + 'k'); // maximum frequency to show in spectrogram
        }
        args.push('-n', 'spectrogram');             // sox spectrogram filter
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
        
        if(options.window && ['Hann', 'Hamming', 'Bartlett', 'Rectangular', 'Kaiser'].indexOf(options.window) >= 0) {
            args.push('-w', options.window); // just the raw spectrogram image
        }
        args.push('-lm');
        args.push('-o', destination_path);
        audiotools.sox(args, {}, callback);
    },
    
    splitter: function(sourcePath, duration, callback) {
        var rec = {};
        rec.ext = path.extname(sourcePath);
        rec.dir = path.dirname(sourcePath);
        rec.filename = path.basename(sourcePath, rec.ext);
        
        var splitCommand = sprintf('sox %(dir)s/%(filename)s%(ext)s %(dir)s/%(filename)s.p%%1n%(ext)s', rec);
        
        var files = [];
        
        // splits only if recording is longer than 2 mins
        if(duration < 120) return callback(null, []);
        
        var oneMinPieces = Math.floor(duration/60)-1;
        var lastPieceLength = duration - (oneMinPieces*60);
        
        for(var i=0; i < oneMinPieces; i++) {
            files.push(sprintf("%s/%s.p%d%s", rec.dir, rec.filename, i+1, rec.ext));
            splitCommand += ' trim 0 60 : newfile :';
        }
        files.push(sprintf("%s/%s.p%d%s", rec.dir, rec.filename, oneMinPieces+1, rec.ext));
        splitCommand += ' trim 0 '+ lastPieceLength;
        
        debug('splitter:', splitCommand);
        
        var split = childProcess.exec(splitCommand, function(error, stdout, stderr) {
            // console.log('stdout: ' + stdout);
            // console.log('stderr: ' + stderr);
            // if (error !== null) {
            //     console.log('exec error: ' + error);
            // }
            // console.log('splits', oneMinPieces+1);
            callback(error, files);
        });
    }
};
//
// audiotools.info('/home/chino/Desktop/file_test.flac', function(code, info) {
//     console.log(code);
//     console.log(info);
//     console.time('splitter');
//     audiotools.splitter(info.input_file, info.duration, function(err, files) {
//         console.timeEnd('splitter');
//         console.log(files);
//     });
//     
// });

module.exports = audiotools;
