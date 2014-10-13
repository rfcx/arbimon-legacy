var formatParse = function(formatName, filename) {
    var formats = {
        Wildlife: /\w+-\w+_(0|1|0\+1)_(\d{4})(\d{2})(\d{2})(_|\$)(\d{2})(\d{2})(\d{2})/,
        Arbimon: /\w+-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})/
    };
    
    if(formatName === 'Arbimon') {
        var results = formats[formatName].exec(filename);
        
        return {
            filename: results[0],
            year: results[1],
            month: results[2],
            date: results[3],
            hour: results[4],
            min: results[5]
        };
    }
    else if(formatName === 'Wildlife') {
        var results = formats[formatName].exec(filename);
        
        return {
            filename: results[0],
            year: results[2],
            month: results[3],
            date: results[4],
            hour: results[6],
            min: results[7]
        };
    }
    else
        throw new Error('invalid format');
    
    return;
};

module.exports = formatParse;
