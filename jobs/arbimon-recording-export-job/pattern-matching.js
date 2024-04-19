require('dotenv').config()
const path = require('path')
const fs = require('fs')
const stream = require('stream');
const csv_stringify = require('csv-stringify');
const { getPmRois } = require('../services/pattern-matching')
const { getSignedUrl } = require('../services/storage')

const S3_LEGACY_BUCKET_ARBIMON = process.env.AWS_BUCKETNAME
const S3_RFCX_BUCKET_ARBIMON = process.env.AWS_RFCX_BUCKETNAME

const exportReportType = 'Pattern Matchings';
const exportReportJob = `Arbimon Export ${exportReportType} job`

async function collectData (projection_parameters, filters, cb) {
  const filePath = path.join('./tmpfilecache', `export-pattern-matchings.csv`)
  const targetFile = fs.createWriteStream(filePath, { flags: 'a' })
  await exportAllPmJobs(filters.project_id, projection_parameters.projectUrl, targetFile, async (err, data) => {
    if (err) {
      console.err('Error export PM', err)
      targetFile.end()
      return cb(err)
    }
    console.log(`${exportReportJob}: finished collecting chunks`)
    targetFile.end()
    cb(null, path.resolve(filePath))
  }).catch((e) => {
    console.err('Error export PM', e)
    cb(e)
  })
}

async function exportAllPmJobs (projectId, projectUrl, targetFile, cb) {
  try {
    console.log(`${exportReportJob} started`)
  
    const limit = 10000;
    let index = 0
    let toProcess = true;
    let isFirstChunk = true

    while (toProcess === true) {
      console.log('next chunk', limit, limit * index)
      const queryResult =  await getPmRois({
        projectId,
        projectUrl,
        limit,
        offset: limit * index
      });
      toProcess = queryResult.length > 0;

      console.log('Arbimon Export PM job: writing chunk')
      await writeChunk(queryResult, targetFile, isFirstChunk)
      isFirstChunk = false
      index++
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
        const filename_parsed = path.parse(recUrl)
        const rfcxPath = path.join(filename_parsed.dir, filename_parsed.name)
        const url = await getSignedUrl({
          Bucket: isLegacy(recUrl) ? S3_LEGACY_BUCKET_ARBIMON : S3_RFCX_BUCKET_ARBIMON,
          Key: isLegacy(recUrl) ? recUrl : rfcxPath,
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
          resolve()
        })
      })
  })
}

module.exports = {
  collectData
}

