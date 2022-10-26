const sha1File = require('sha1-file')
const fs = require('fs')

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
    }
}

module.exports = fileHelper;
