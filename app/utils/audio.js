const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path.replace('app.asar', 'app.asar.unpacked')
const ffprobePath = require('@ffprobe-installer/ffprobe').path.replace('app.asar', 'app.asar.unpacked')
const ffmpeg = require('fluent-ffmpeg')
ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

const audioService = {
    convert: function (sourceFile, destinationPath, metadata) {
        /**
        * convert wav files to flac
        * @returns desination path of the converted file
        */
        const basedOutputOptions = ['-ac 1'] // force convert to mono channel
        const meta = metadata ? ['-metadata', `comment=${metadata.comment}`, '-metadata', `artist=${metadata.artist}`] : []
        const outputOptions = basedOutputOptions.concat(meta)
        console.log('\n\n------outputOptions------', outputOptions)
        return new Promise((resolve, reject) => {
            const command = ffmpeg(sourceFile)
            .noVideo()
            .output(destinationPath)
            .outputOptions(outputOptions)

            const timeout = setTimeout(function () {
            command.kill()
            reject(Error('Timeout')) // TODO: move to errors
            }, 60000)

            command
            .on('error', function (err, stdout, stderr) {
                clearTimeout(timeout)
                reject(err)
            })
            .on('end', async function (stdout, stderr) {
                clearTimeout(timeout)
                try {
                resolve({
                    path: destinationPath
                })
                } catch (e) { reject(e) }
            })
            .run()
        })
    }
}

module.exports = audioService;
