const moment = require('moment-timezone')

const dateHelper = {
    getNonDlsOffset: function(timezone) {
        // Standart time (STD) offset
        const dates = ['2022-01-02', '2022-02-02', '2022-03-02', '2022-04-02', '2022-05-02', '2022-06-02', '2022-06-02', '2022-07-02', '2022-08-02', '2022-09-02', '2022-10-02', '2022-11-02', '2022-12-02']
        const dsdDay = dates.find(date => moment(date).tz(timezone).isDST())
        const stdDay = dates.find(date => !moment(date).tz(timezone).isDST())
        if (timezone === 'Europe/Dublin') return moment(dsdDay).tz(timezone).utcOffset();
        return moment(stdDay).tz(timezone).utcOffset();
    },
    getNonDlsDatetime: function(datetime, timezone, format) {
        // get datetime converted with STD offset
        return moment(datetime).tz(timezone).utcOffset(this.getNonDlsOffset(timezone), true).format(format)
    }
}

module.exports = dateHelper;
