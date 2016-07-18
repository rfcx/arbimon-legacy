var streaming = require('./streaming');

/** Returns a stream that transforms raw text lines from a log into log entries.
 * @return {stream.Transform} stream that transforms raw text lines from a log into log entries.
 */
var log_entry_parser = streaming.make_stream_fn({objectMode:true}, {
    transform: function(line, _, done){
        var m = /^([^-]+) - ?(.*)$/.exec(line);
        var entry = m && parse_log_entry(m[2]);
        if(entry){
            entry.date = parse_date(m[1].trim());
            this.push(entry);
            done();
        }
    }
});

/** Parses a java date string to javascript.
 * @param {String} datestr -  string containing date in java format.
 * @return {Date} with the datetime represented by datestr.
 */
function parse_date(datestr){
    var d;
    if((d = /^(\w+ \w+ \d+) (\d+:\d+:\d+) ([^ ]+) (\d+)$/.exec(datestr))){
        if(!/^(GMT.+|\([^)]+\))$/.test(d[3])){
            d[3] = '(' + d[3] + ')';
        }
        d = [d[1],d[4],d[2],d[3]].join(' ');
    }
    return new Date(d);
}

/** Parses a log entry from its textual representation. 
 * @param {String} a log entry line.
 * @return {Object} representing the parsed log entry.
 */
function parse_log_entry(line){
    var comps = /^([^:]*):(.*)$/.exec(line);
    var data;
    if(comps){
        data = {tag:comps[1].trim().toLowerCase().replace(/\W/,'')};
        line = comps[2].trim();        
        switch(data.tag){
            case 'network':
                if(line == 'disconnected. No NetworkInfo.'){ 
                    data.connected = null;
                } else if(/^connected\./i.test(line)){
                    data.connected = line.substr(10).trim();
                } else {
                    data.tag = 'notice';
                    data.line = line;
                }
            break;
            case 'powerstate':
                line = /^\[?(.*?)\]?$/.exec(line)[1];
                comps = line.split(',');
                power = comps.shift().split('/');
                data.power = 100 * (+power[0]) / (+power[1]);
                comps.forEach(function(c){
                    var kv = c.split(':');
                    data[kv[0].trim().toLowerCase()] = kv[1].toLowerCase();
                });
                data.battery = data.battery == 'yes';
                data.voltage = 1*(data.voltage || -1);
                data.temp = (data.temp || -1) / 10;
                if(data.tech == 'null'){
                    data.tech = null;
                }
            break;
            case 'resetalarm': break;
            case 'notice': data.message = line; break;
            default: data.line = line; break;
        }
    }
    return data;    
}

/** Returns a stream that transforms parsed log entries into site log entries.
* @return {stream.Transform} stream that transforms parsed log entries into site log entries.
*/
var log_entry_to_site_entry_processor = streaming.make_stream_fn({objectMode:true}, {
    transform: function(log_entry, _, done){
        var _entry;
        switch(log_entry.tag){
            case 'notice'     : _entry = ['event', {date:log_entry.date, type:'notice', message:log_entry.message }]; break;
            case 'config'     : _entry = ['event', {date:log_entry.date, type:'config', message:log_entry.line    }]; break;
            case 'resetalarm' : _entry = ['event', {date:log_entry.date, type:'alarm', message:'Radio Reset Alarm'}]; break;
            case 'network'    : _entry = ['connection', {date:log_entry.date, connection:log_entry.connected     }]; break;
            case 'powerstate' : _entry = ['data', {date:log_entry.date, 
                    power: log_entry.power, battery: log_entry.battery, health: log_entry.health, status: log_entry.status,
                    plug_type: log_entry.plug, bat_tech: log_entry.tech, temp: log_entry.temp, voltage: log_entry.voltage,
            }]; break;
            // default: this.push(log_entry); break;
        }
        if(_entry){
            this.push(_entry);
        }
        done();
    }
});



module.exports = {
    parse_date : parse_date,
    parse_log_entry : parse_log_entry,
    log_entry_parser : log_entry_parser,
    log_entry_to_site_entry_processor : log_entry_to_site_entry_processor,
};