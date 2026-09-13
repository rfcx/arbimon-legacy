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
  const zipPath = `jobs/arbimon-recording-export-job/${reportName}.zip`
  console.log('\n\n<- [streamToBuffer] reportName, is exists:', zipPath, fs.existsSync(zipPath))
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(zipPath);
    const data = [];

    stream.on('data', (chunk) => {
      console.log('\n\n<- [streamToBuffer] chunk', chunk)
      data.push(chunk);
      console.log('\n\n<- [streamToBuffer] data length', data.length)
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

// Make a user-controlled string safe as a SINGLE filesystem path component.
// The export writers build CSV/zip filenames from job / playlist / species
// names that users type freely. A '/' in the name silently turns the target
// into a SUBDIRECTORY path and the WriteStream open fails ENOENT; '\', NUL /
// control chars, a leading '.' (hidden-file / traversal shape) and an
// over-long component (ENAMETOOLONG) are the same class. Measured live
// 2026-09-12: classification job "S. fuscovarius 80/20 B2" produced
// 'rfm_s._fuscovarius_80/20_b2.csv', the unhandled WriteStream 'error' killed
// the consumer process, and the reconciler re-picked the poison row every 5
// min — crash-looping the WHOLE export queue.
//
// Deliberately CONSERVATIVE: nameToUrl() would also rewrite the spaces/dots
// of already-working names (changing the filenames users see in their
// emails); this neutralizes ONLY the characters hostile to a filesystem, so
// previously-working names keep their current shape byte-for-byte.
function sanitizeFilename (name) {
  const cleaned = String(name == null ? '' : name)
    .replace(/[\\/\x00-\x1f\x7f]/g, '_') // path separators + control chars (incl. NUL)
    .replace(/^\.+/, '_')                 // no leading dots ('.hidden', '..')
    .slice(0, 200)                        // stay well under NAME_MAX
  return cleaned.length ? cleaned : '_'
}

function isLegacy (uri) {
  return uri.startsWith('project_')
}

module.exports = {
  zipDirectory,
  streamToBuffer,
  nameToUrl,
  sanitizeFilename,
  isLegacy
}
