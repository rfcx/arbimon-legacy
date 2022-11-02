const sha1File = require('sha1-file')
const fs = require('fs')
const moment = require('moment-timezone')

const fileHelper = {
    getExtension: function(fileName) {
        return fileName.split('.').pop().toLowerCase()
    },
    getCheckSum: function(filePath) {
        const checksum = sha1File(filePath)
        return checksum
    },
    getFileSize: function(filePath) {
        const stats = fs.statSync(filePath)
        return stats.size
    },
    getTempPath: function(tmpPath, fileName, streamId) {
        return `${tmpPath}/${fileName}-${streamId}`
    },
    tzOffsetMinutesFromTzName: function(timezoneName) {
        return this.getMomentFromTimezoneName(timezoneName).utcOffset()
    },
    getMomentFromTimezoneName: function(timezone) {
        if (!timezone) return null
        const dateString = moment().tz(timezone).format()
        return moment.parseZone(dateString)
    },
    formattedTzOffsetFromTimezoneName: function(timezoneName) {
        return this.getMomentFromTimezoneName(timezoneName).format('zZ')
    }
}

module.exports = fileHelper;
