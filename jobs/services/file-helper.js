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

async function streamToBuffer (reportName) {
  console.log('\n\n<- [streamToBuffer] reportName', `jobs/arbimon-recording-export-job/${reportName}.zip`)
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(`jobs/arbimon-recording-export-job/${reportName}.zip`);
    const data = [];

    stream.on('data', (chunk) => {
      console.log('\n\n<- [streamToBuffer] chunk', chunk)
      data.push(chunk);
    });

    stream.on('end', () => {
      console.log('\n\n<- [streamToBuffer] resolve')
      resolve(Buffer.concat(data))
    })

    stream.on('error', (err) => {
      console.log('\n\n<- [streamToBuffer] error', err)
      reject(err)
    })
  
  })
}

function nameToUrl (name) {
  return name.replace(/[^a-z0-9A-Z-]/g, '-').replace(/-+/g,'-').replace(/(^-)|(-$)/g, '').toLowerCase()
}

function isLegacy (uri) {
  return uri.startsWith('project_')
}

module.exports = {
  zipDirectory,
  streamToBuffer,
  nameToUrl,
  isLegacy
}
