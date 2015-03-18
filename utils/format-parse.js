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
        datetime: new Date(results[2], (results[3]-1), results[4], results[5], results[6]),
        filetype: results[7]
    };

};

module.exports = formatParse;
