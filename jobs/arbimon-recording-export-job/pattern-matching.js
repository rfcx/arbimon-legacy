require('dotenv').config()
const path = require('path')
const fs = require('fs')
const stream = require('stream');
const csv_stringify = require('csv-stringify');
const { getPmRois, getProjectPMJobs } = require('../services/pattern-matching')
const { zipDirectory } = require('../services/file-helper')
const { getSignedUrl } = require('../services/storage')

const S3_LEGACY_BUCKET_ARBIMON = process.env.AWS_BUCKETNAME
const S3_RFCX_BUCKET_ARBIMON = process.env.AWS_RFCX_BUCKETNAME

const exportReportType = 'Pattern Matchings';
const exportReportJob = `Arbimon Export ${exportReportType} job`
const tmpFilePath = 'jobs/arbimon-recording-export-job/tmpfilecache'

async function collectData (filters, cb) {
  await exportAllPmJobs(filters.project_id, async (err, data) => {
    if (err) {
      console.err('Error export PM', err)
      return cb(err)
    }
    console.log(`${exportReportJob}: finished collecting jobs`)
    cb(null, null)
  }).catch((e) => {
    console.err('Error export PM', e)
    cb(e)
  })
}

async function buildPMFolder() {
  await zipDirectory(tmpFilePath, 'jobs/arbimon-recording-export-job/pattern-matching-export.zip')
}

function nameToUrl (name) {
  return name.replace(/[^a-z0-9A-Z-]/g, '-').replace(/-+/g,'-').replace(/(^-)|(-$)/g, '').toLowerCase()
}

async function exportAllPmJobs (projectId, cb) {
  try {
    console.log(`${exportReportJob} started`)
    const projectPMJobs = await getProjectPMJobs({projectId})
    for (let job of projectPMJobs) {
      const filename = `${job.jobId}-${nameToUrl(job.jobName)}.csv`;
      const filePath = path.join(tmpFilePath, filename)
      const targetFile = fs.createWriteStream(filePath, { flags: 'a' })
      console.log('targetFile start', filename)
      const limit = 10000;
      let index = 0
      let toProcess = true;
      let isFirstChunk = true
      while (toProcess === true) {
        console.log('next chunk for', filename)
        const queryResult =  await getPmRois({
          projectId,
          jobId: job.jobId,
          limit,
          offset: limit * index
        });
        toProcess = queryResult.length > 0;
        console.log('Arbimon Export PM job: writing chunk')
        await writeChunk(queryResult, targetFile, isFirstChunk)
        isFirstChunk = false
        index++
      }
      console.log('targetFile end', filename)
      targetFile.end()
    }
    cb(null, null)
  } catch (e) {
    console.error(e)
    cb(null, null)
  }
}

function isLegacy (uri) {
    return uri.startsWith('project_')
}

async function writeChunk (results, targetFile, isFirstChunk) {
  return new Promise(async function (resolve, reject) {
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
        const recUrl = result.audio_url
        const url = await getSignedUrl({
          Bucket: isLegacy(recUrl) ? S3_LEGACY_BUCKET_ARBIMON : S3_RFCX_BUCKET_ARBIMON,
          Key: recUrl,
          isLegacy: isLegacy(recUrl)
        });
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

      datastream.on('end', async () => {
        csv_stringify(_buf, { header: isFirstChunk, columns: fields }, async (err, data) => {
          if (err) {
            reject(err)
          }
          targetFile.write(data)
          console.log('targetFile write', _buf.length)
          resolve()
        })
      })
  })
}

module.exports = {
  collectData,
  buildPMFolder
}

