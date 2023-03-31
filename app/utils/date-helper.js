const moment = require('moment-timezone')

const dateHelper = {
    getNonDlsOffset: function(timezone) {
        // Standart time (STD) offset
        const janOffset = moment({M:0, d:1}).tz(timezone).utcOffset();
        const julOffset = moment({M:6, d:1}).tz(timezone).utcOffset();
        const stdOffset = Math.min(janOffset, julOffset);
        const nowWithoutDST = moment().tz(timezone).utcOffset(stdOffset);
        return nowWithoutDST.format('Z');
    },
    getNonDlsDatetime: function(datetime, timezone, format) {
        // get datetime converted with STD offset
        const isDST = moment(datetime).tz(timezone).isDST()
        return isDST
            ? moment(datetime).tz(timezone).utcOffset(this.getNonDlsOffset(timezone), true).format(format)
            : moment(datetime).tz(timezone).format(format)
    }
}

module.exports = dateHelper;
