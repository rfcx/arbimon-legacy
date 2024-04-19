require('dotenv').config()
const path = require('path')
const { getPmRois } = require('../services/pattern-matching')
const fs = require('fs')
const stream = require('stream');
const csv_stringify = require('csv-stringify');

async function collectData (projection_parameters, filters, cb) {
  const filePath = path.join('./tmpfilecache', `export-pattern-matchings.csv`)
  const targetFile = fs.createWriteStream(filePath, { flags: 'a' })
  await exportAllPmJobs(filters.project_id, projection_parameters.projectUrl, targetFile, async (err, data) => {
    if (err) {
      console.err('Error export PM', err)
      targetFile.end()
      return cb(err)
    }
    console.log('Arbimon Export PM job: finished collecting chunks')
    targetFile.end()
    cb(null, path.resolve(filePath))
  }).catch((e) => {
    console.err('Error export PM', e)
    cb(e)
  })
}

async function exportAllPmJobs (projectId, projectUrl, targetFile, cb) {
  try {
    console.log('arbimon-export-all-project-pm-rois job started')
  
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

