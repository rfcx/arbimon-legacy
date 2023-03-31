const moment = require('moment-timezone')

const dateHelper = {
    getNonDlsOffset: function(timezone) {
        // Standart time (STD) offset
        return moment('2022-12-01T00:00:00').tz(timezone).utcOffset() / 60
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
