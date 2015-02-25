var formatParse = function(formatName, filename) {
    var formats = {
        Wildlife: /(.*(\d{4})(\d{2})(\d{2})[_|\$](\d{2})(\d{2})\d{2}.*)(\.\w+)$/,
        Arbimon: /(.*(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2}).*)(\.\w+)$/
    };
    
    
    if(typeof formats[formatName] === 'undefined') {
        throw new Error('invalid_format: "' + formatName + '"');
    }
    
    var results = formats[formatName].exec(filename);
    
    if(results === null) {
        throw new Error('invalid_filename: "' + filename + '"');
    }
    
    return {
        filename: results[1],
        year: results[2],
        month: results[3],
        date: results[4],
        hour: results[5],
        min: results[6],
        filetype: results[7] 
    };

};

module.exports = formatParse;

// test
// console.log(formatParse('Wildlife','TEST_SM3_ 20140530_0630000.mp3'));
// console.log(formatParse('Wildlife','SM3_20140530_050000_000.wav'));
// console.log(formatParse('Arbimon','2014-08-25_17-30.flac'));
// console.log(formatParse('Arbimon','default-2014-08-25_17-30.flac'));
// console.log(formatParse('arbimon','fsldfjslk/d'));
