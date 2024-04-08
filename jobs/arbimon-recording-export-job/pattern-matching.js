require('dotenv').config()
const path = require('path')
const { getPmRois } = require('../services/pattern-matching')
const fs = require('fs')
const stream = require('stream');
const csv_stringify = require('csv-stringify');

async function collectData (projection_parameters, filters, cb) {
  let isFirstChunk = true
  const filePath = path.join('./tmpfilecache', `${(new Date()).toISOString()}.csv`)
  const targetFile = fs.createWriteStream(filePath, { flags: 'a' })
  await exportAllPmJobs(filters.project_id, projection_parameters.projectUrl, async (e, data) => {
    if (e) {
      targetFile.end()
      return cb(e)
    }
    if (data) {
      console.log('Arbimon Export PM job: writing chunk')
      await writeChunk(data, targetFile, isFirstChunk)
    }
    isFirstChunk = false
    console.log('Arbimon Export PM job: finished collecting chunks')
    targetFile.end()
    cb(null, path.resolve(filePath))
  }).catch((e) => {
    cb(e)
  })
}

async function exportAllPmJobs (projectId, projectUrl, cb) {
  try {
    console.log('arbimon-export-all-project-pm-rois job started')
  
    const limit = 10000;
    let index = 0
    let toProcess = true;
    let results = [];

    while (toProcess === true) {
      const queryResult =  await getPmRois({
        projectId,
        projectUrl,
        limit,
        offset: limit * index
      });
      results.push(...queryResult);
      toProcess = queryResult.length > 0;
      index++
    }
    if (results.length) {
      cb(null, results)
      results = null
    } else {
      cb(null, null)
    }
  } catch (e) {
    console.error(e)
    cb(null, null)
  }
}

async function writeChunk (results, targetFile, isFirstChunk) {
  return new Promise(function (resolve, reject) {
      let fields = [];
      results.forEach(result => {
          fields.push(...Object.keys(result).filter(f => !fields.includes(f)))
      });

      let datastream = new stream.Readable({objectMode: true});
      let _buf = []

      results.forEach(result => {
        fields.forEach(f => {
          if (result[f] === undefined || result[f] === null) {
            result[f] = '---'}
          }
        )
        datastream.push(result)
      });
      datastream.push(null);

      datastream.on('data', (d) => {
        _buf.push(Object.values(d))
      })

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

