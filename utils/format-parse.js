/**
 * parses filename and return datetime data and file extension
 * @exports utils/format-parse
 * @param {String} formatName - Name that indentifies the format in use on the filename
 * @param {String} filename - filename to parse
 * 
 * @example
 * var formatParse = require('util/format-parse');
 * 
 * ffi = formatParse('Arbimon', 'stereo_wav-2014-07-14_08-20.wav');
 * @returns ffi - file format info [Object]<br>
 *  - ffi.filename [String] - filename without file extension<br>
 *  - ffi.datetime [Date] - time read from format<br>
 *  - ffi.filetype [String] - file extension<br>
 */

var formatParse = function(formatName, filename) {
    var formats = {
        Wildlife: /(.*(\d{4})(\d{2})(\d{2})[_|\$](\d{2})(\d{2})\d{2}.*)(\.\w+)$/,
        Arbimon: /(.*(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})(-(\d{2}))?.*)(\.\w+)$/
    };
    
    
    if(typeof formats[formatName] === 'undefined') {
        throw new Error('invalid_format: "' + formatName + '"');
    }
    
    var results = formats[formatName].exec(filename);
    
    if(results === null) {
        throw new Error('invalid_filename: "' + filename + '"');
    }
    
    if(formatName == 'Arbimon'){
        return {
            filename: results[1],
            datetime: results[7] ? new Date(results[2], (results[3]-1), results[4], results[5], results[6], results[8]):
                                   new Date(results[2], (results[3]-1), results[4], results[5], results[6]),
            filetype: results[9]
        };
    }
    
    return {
        filename: results[1],
        datetime: new Date(results[2], (results[3]-1), results[4], results[5], results[6]),
        filetype: results[7]
    };

};
formatParse.formats = {}

module.exports = formatParse;
