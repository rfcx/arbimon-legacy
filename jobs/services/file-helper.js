const fs = require('fs')
const archiver = require('archiver');

/**
 * @param {String} sourceDir: /some/folder/to/compress
 * @param {String} outPath: /path/to/created.zip
 * @returns {Promise}
 */
async function zipDirectory (sourceDir, outPath) {
  const archive = archiver('zip', { zlib: { level: 9 }});
  const stream = fs.createWriteStream(outPath);

  return new Promise((resolve, reject) => {
    archive
      .directory(sourceDir, false)
      .on('error', (err) => {
        console.log('\n\n<- zipDirectory error', err)
        reject(err)
      })
      .pipe(stream)
    ;

    stream.on('close', () => resolve());
    archive.finalize();
  });
}

async function streamToBuffer () {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream('jobs/arbimon-recording-export-job/tmpfilecache/occupancy-export.zip');
    const data = [];

    stream.on('data', (chunk) => {
      data.push(chunk);
    });

    stream.on('end', () => {
      resolve(Buffer.concat(data))
    })

    stream.on('error', (err) => {
      console.log('\n\n<- streamToBuffer error', err)
      reject(err)
    })
  
  })
}


module.exports = {
  zipDirectory,
  streamToBuffer
}
