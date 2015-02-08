var formatParse = function(formatName, filename) {
    var formats = {
        Wildlife: /.+(\d{4})(\d{2})(\d{2})[_|\$](\d{2})(\d{2})(\d{2}).+/,
        Arbimon: /.+(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2}).+/
    };
    
    
    if(typeof formats[formatName] === 'undefined') {
        throw new Error('invalid_format: "' + formatName + '"');
    }
    
    var results = formats[formatName].exec(filename);
    
    if(results === null) {
        throw new Error('invalid_filename: "' + filename + '"');
    }
    
    return {
        filename: results[0],
        year: results[1],
        month: results[2],
        date: results[3],
        hour: results[4],
        min: results[5]
    };

};

module.exports = formatParse;

// test
// console.log(formatParse('Wildlife','TEST_SM3_20140530_0630000.wav'));
// console.log(formatParse('Wildlife','SM3_20140530_050000_000.wav'));
// console.log(formatParse('Arbimon','default-2014-08-25_17-30.flac'));
// console.log(formatParse('arbimon','fsldfjslk/d'));
