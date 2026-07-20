require('dotenv').config()
const path = require('path')
const fs = require('fs')
const { rename } = require('fs/promises')
const stream = require('stream');
const csv_stringify = require('csv-stringify');
const archiver = require('archiver');
const { getPmRois, getProjectPMJobs, getProjectSites } = require('../services/pattern-matching')
const { zipDirectory, nameToUrl, isLegacy } = require('../services/file-helper')
const { getSignedUrl } = require('../services/storage')
const { getRecordingByIds } = require('../services/recordings')

const S3_LEGACY_BUCKET_ARBIMON = process.env.AWS_BUCKETNAME
const S3_RFCX_BUCKET_ARBIMON = process.env.AWS_RFCX_BUCKETNAME

const exportReportType = 'Pattern Matchings';
const exportReportJob = `Arbimon Export ${exportReportType} job`
const tmpFilePath = __dirname + '/tmpfilecache'

const archive = archiver('zip', { zlib: { level: 9 }});
let outputStreamFile

// Wait until a WriteStream has actually flushed + closed its file descriptor
// before anything tries to read the file back. createWriteStream opens the
// file LAZILY/asynchronously, so a read issued immediately after .end() can
// beat the open() and ENOENT. This helper is the fix for the historical
// "_pattern_matching.csv ENOENT" crash (the file was written but a reader
// raced ahead of the flush). Resolves on 'close'; rejects on stream 'error'.
function endAndFlush (writeStream) {
  return new Promise((resolve, reject) => {
    // Guard: if the stream is already closed, resolve immediately (a 'close'
    // that already fired would otherwise never re-fire and this would hang).
    if (writeStream.closed || writeStream.destroyed) return resolve()
    let settled = false
    const done = (err) => {
      if (settled) return
      settled = true
      if (err) reject(err); else resolve()
    }
    writeStream.on('error', done)
    writeStream.on('close', () => done())
    writeStream.on('finish', () => {
      // 'finish' fires when all data is flushed to the OS. If the stream
      // doesn't emit 'close' (emitClose disabled), fall back to it so we
      // never hang; the fd is flushed by this point.
      if (!writeStream.emitClose) done()
    })
    writeStream.end()
  })
}

async function collectData (filters, projection_parameters, cb) {
  // Ensure the intermediate-CSV directory exists (belt-and-braces; the image
  // Dockerfile also pre-creates it). Without it every createWriteStream ENOENTs.
  try {
    fs.mkdirSync(tmpFilePath, { recursive: true })
  } catch (e) {
    console.error(`${exportReportJob}: could not create tmp dir ${tmpFilePath}`, e)
    return cb(e)
  }

  outputStreamFile = fs.createWriteStream(__dirname + '/pattern-matching_export.zip');
  // If the zip output stream itself errors, surface it (don't let it become an
  // unhandled 'error' event that hard-crashes the process).
  outputStreamFile.on('error', (err) => {
    console.error(`${exportReportJob}: output zip stream error`, err)
  })

  archive.pipe(outputStreamFile)
  try {
    await exportAllPmJobs(filters.project_id, projection_parameters, async (err, data) => {
      if (err) {
        console.error('Error export PM', err)
        return cb(err)
      }
      try {
        console.log(`${exportReportJob}: before finalizeArchive`)
        await finalizeArchive()
        console.log(`${exportReportJob}: after finalizeArchive`)
        if (data !== null) {
          const newPath = __dirname + `/${data}.zip`
          await rename(__dirname + '/pattern-matching_export.zip', newPath)
          if (!fs.existsSync(newPath)) {
            return cb(new Error(`Renamed export archive missing: ${newPath}`))
          }
          return cb(null, data)
        }
        return cb(null, null)
      } catch (e) {
        console.error('Error finalizing/renaming PM export archive', e)
        return cb(e)
      }
    })
  } catch (e) {
    console.error('Error export PM', e)
    return cb(e)
  }
}

async function finalizeArchive () {
    return new Promise((resolve, reject) => {
      archive.on('error', (err) => {
        console.log('\n\n<- fileToZipDirectory error', err)
        reject(err)
      })
      archive.on('end', () => {
        console.log('\n\n<- fileToZipDirectory added')
        resolve()
      })
      archive.finalize();
    });
}

async function fileToZipDirectory (sourceFilePath, sourceFileName) {
  console.log('<- start fileToZipDirectory sourceFilePath', sourceFilePath)
  console.log('<- start fileToZipDirectory sourceFileName', sourceFileName)
  return new Promise((resolve, reject) => {
    const src = fs.createReadStream(sourceFilePath)
    src
      .on('end', function() { console.log('<- 1. End fileToZipDirectory.', sourceFileName); resolve() })
      .on('error', function(err) {
        // Was `reject()` with NO argument -> the process saw an
        // UnhandledPromiseRejection with reason `undefined` and hard-crashed
        // BEFORE the export row's `error` could be set (poison-row wedge).
        // Always reject with a real Error.
        console.log('<- 1. Error fileToZipDirectory.', sourceFileName, err)
        reject(err instanceof Error ? err : new Error(`fileToZipDirectory failed for ${sourceFileName}: ${err}`))
      })
    archive.append(src, { name: sourceFileName })
  });
}

async function exportAllPmJobs (projectId, projection_parameters, cb) {
  try {
    console.log(`${exportReportJob} started`)
    const projectSites = await getProjectSites({projectId})
    const projectPMJobs = await getProjectPMJobs({projectId, jobs: projection_parameters.pmIds})
    await exportAllPmJobsCsv(projectPMJobs)
    let fileNameForOneJob
    for (let job of projectPMJobs) {
      const fileName = `pm_${nameToUrl(job.job_name)}_${job.job_id}.csv`;
      fileNameForOneJob = `pm_${nameToUrl(job.job_name)}_${job.job_id}`
      const filePath = path.join(tmpFilePath, fileName)
      const targetFile = fs.createWriteStream(filePath, { flags: 'a' })
      targetFile.on('error', (err) => {
        // Prevent a lazy-open ENOENT (or disk error) from becoming an
        // unhandled 'error' event on the stream that crashes the process.
        console.error('<- targetFile stream error', fileName, err)
      })
      console.log('next PM job start:', fileName)
      const limit = 5000;
      let index = 0
      let toProcess = true;
      let isFirstChunk = true
      while (toProcess === true) {
        console.log('next chunk for', fileName)
        const queryResult =  await getPmRois({
          projectId,
          jobId: job.job_id,
          limit,
          offset: limit * index
        });
        toProcess = queryResult.length > 0;
        if (toProcess) {
          console.log('Arbimon Export PM job: writing chunk: rows length', queryResult.length)
          await writeChunk(queryResult, targetFile, projectSites, isFirstChunk)
        }
        isFirstChunk = false
        index++
      }
      // Flush + close the per-job CSV BEFORE zipping it, so the read stream in
      // fileToZipDirectory can never race the write's lazy flush.
      await endAndFlush(targetFile)
      console.log('PM job end:', fileName)
      await fileToZipDirectory(filePath, fileName)
      await new Promise((resolve) => {
        fs.unlink(filePath, function(err){
          if (err) console.error('<- 2. error pm csv delete', fileName, err);
          else console.log('<- 2. pm csv deleted successfully', fileName);
          resolve()
        })
      })
    }
    if (projectPMJobs && projectPMJobs.length && projectPMJobs.length === 1) {
      cb(null, fileNameForOneJob)
    } else cb(null, null)
  } catch (e) {
    // Propagate the real error so index.js records `error` on the row and the
    // queue advances, instead of the old `cb(null, null)` which reported
    // SUCCESS on failure (and, combined with the write-before-read race, left
    // a broken/empty archive to be emailed).
    console.error('Error in exportAllPmJobs', e)
    cb(e)
  }
}

async function exportAllPmJobsCsv (results) {
  const fileName = '_pattern_matching.csv';
  const filePath = path.join(tmpFilePath, fileName)
  const targetFileSummaryData = fs.createWriteStream(filePath, { flags: 'a' })
  targetFileSummaryData.on('error', (err) => {
    console.error('<- _pattern_matching.csv stream error', err)
  })
  return new Promise(function (resolve, reject) {
    let fields = [];
    results.forEach(result => {
        fields.push(...Object.keys(result).filter(f => !fields.includes(f)))
    });

    let datastream = new stream.Readable({objectMode: true});
    let _buf = []

    for (let result of results) {
      fields.forEach(f => {
        if (result[f] === undefined || result[f] === null) {
          result[f] = '---'}
        }
      )
      datastream.push(result)
    }
    datastream.push(null);

    datastream.on('data', (d) => {
      _buf.push(Object.values(d))
    })

    datastream.on('end', () => {
      csv_stringify(_buf, { header: true, columns: fields }, async (err, data) => {
        try {
          if (err) return reject(err)
          targetFileSummaryData.write(data)
          // Flush + close BEFORE reading the file back to zip it. This is the
          // core fix for the "_pattern_matching.csv ENOENT" crash: the old code
          // called fileToZipDirectory() immediately after .end() and the read
          // raced the write's lazy flush (worked on fast disks, ENOENT'd in the
          // container).
          await endAndFlush(targetFileSummaryData)
          await fileToZipDirectory(filePath, fileName)
          await new Promise((res) => {
            fs.unlink(filePath, function(uErr) {
              if (uErr) console.error('<- 2. error targetFileSummaryData delete', fileName, uErr);
              else console.log('<- 2. targetFileSummaryData deleted successfully', fileName);
              res()
            })
          })
          resolve()
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)))
        }
      })
    })
  })
}

async function writeChunk (results, targetFile, projectSites, isFirstChunk) {
  return new Promise(async function (resolve, reject) {
    try {
      let fields = [];
      results.forEach(result => {
          fields.push(...Object.keys(result).filter(f => !fields.includes(f)))
      });
      fields.splice(13, 0, 'site_name');
      fields.push('audio_url')

      let datastream = new stream.Readable({objectMode: true});
      let _buf = []

      let recordingIds = results.map(r => r.recording_id)
      recordingIds = [...new Set(recordingIds)]
      const recs = await getRecordingByIds({ recordingIds })
      for (let result of results) {
        const curSite = projectSites.filter(s => s.site_id === result.site_id)
        result.site_name = result.site_id && curSite.length ? projectSites.filter(s => s.site_id === result.site_id)[0].name : '---';
        fields.forEach(f => {
          if (result[f] === undefined || result[f] === null) {
            result[f] = '---'}
          }
        )
        const rec = recs.filter(r => r.recording_id === result.recording_id)[0]
        const recUrl = rec ? rec.uri : null;
        let url = '---'
        if (recUrl) {
          url = await getSignedUrl({
            Bucket: isLegacy(recUrl) ? S3_LEGACY_BUCKET_ARBIMON : S3_RFCX_BUCKET_ARBIMON,
            Key: recUrl,
            isLegacy: isLegacy(recUrl)
          });
        }
        result.audio_url = url;
        _buf.push(result);
      }
      datastream.on('data', (d) => {
        _buf.push(d);
      })
      for (let result of _buf) {
        datastream.push(result);
      }
      datastream.push(null);

      datastream.on('end', () => {
        csv_stringify(_buf, { header: isFirstChunk, columns: fields }, async (err, data) => {
          if (err) {
            return reject(err instanceof Error ? err : new Error(String(err)))
          }
          console.log('targetFile write', _buf.length)
          targetFile.write(data);
          return resolve();
        })
      })
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}

module.exports = {
  collectData
}
