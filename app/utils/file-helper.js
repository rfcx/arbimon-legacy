const sha1File = require('sha1-file')
const fs = require('fs')
const moment = require('moment-timezone')
const audioService = require('./audio')
const path = require('path')
const { RIFFFile } = require('riff-file')
const audioFilePattern = /\.(wav|flac|opus)$/i;
const { unpackString } = require('byte-data')

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
    },
    /** Function to read SongMeter metadata in GUAN format */
    readGuanMetadata: function(filePath) {
        const wavFile = fs.readFileSync(filePath)
        const riff = new RIFFFile()
        riff.setSignature(wavFile)
        const guanChunk = riff.findChunk('guan')
        return guanChunk ? unpackString(wavFile, guanChunk.chunkData.start, guanChunk.end) : null
    },
    convert: async function(filePath, metadata) {
        const flacFilePath = filePath.replace(audioFilePattern, '.flac');
        return audioService.convert(filePath, flacFilePath, metadata)
    }
}

module.exports = fileHelper;
