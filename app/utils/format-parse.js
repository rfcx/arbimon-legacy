/**
 * parses filename and return datetime data and file extension
 * @exports utils/format-parse
 * @param {String} formatName - Name that indentifies the format in use on the filename, can be an array of formats, or "any".
 *                              "any" causes it to use the first matching format.
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
        Cornell : /(.*(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})\d{2}.*)(\.\w+)$/,
        Wildlife: /(.*(\d{4})(\d{2})(\d{2})[_|\$](\d{2})(\d{2})\d{2}.*)(\.\w+)$/,
        Arbimon: /(.*(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})(-(\d{2}))?.*)(\.\w+)$/,
        'AudioMoth legacy': /([0-9A-F]{8})(\.\w+)$/,
        AudioMoth: /(.*(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2}))(\.\w+)$/,
        SongMeter: /(SM-.*_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2}))(\.\w+)$/
    };
    var parsed, errors=[];

    if(formatName == 'any'){
        formatName = Object.keys(formats);
    }

    var formatNames = formatName instanceof Array ? formatName.slice() : [formatName];

    while(!parsed && formatNames.length){
        formatName = formatNames.shift();
        var results = formats[formatName] && formats[formatName].exec(filename);

        if(results) {
            if(formatName == 'Arbimon'){
                parsed = {
                    filename: results[1],
                    datetime: results[7] ? new Date(results[2], (results[3]-1), results[4], results[5], results[6], results[8]):
                    new Date(results[2], (results[3]-1), results[4], results[5], results[6]),
                    filetype: results[9]
                };
            } else if (formatName == 'AudioMoth legacy') {
                parsed = {
                    filename: results[1],
                    datetime: new Date(parseInt(results[1], 16)*1000),
                    filetype: results[2]
                };
            } else if (formatName == 'AudioMoth' || formatName == 'SongMeter') {
                parsed = {
                    filename: results[1],
                    datetime: new Date(results[2], results[3]-1, results[4], results[5], results[6], results[7]),
                    filetype: results[8]
                };
            } else {
                parsed = {
                    filename: results[1],
                    datetime: new Date(results[2], (results[3]-1), results[4], results[5], results[6]),
                    filetype: results[7]
                };
            }
        }
    }

    if(!parsed){
        throw new Error('invalid_filename: "' + filename + '"');
    }

    return parsed;

};

formatParse.formats = {};

module.exports = formatParse;
