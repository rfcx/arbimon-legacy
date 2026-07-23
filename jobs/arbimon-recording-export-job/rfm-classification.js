require('dotenv').config()
const path = require('path')
const fs = require('fs')
const stream = require('stream');
const csv_stringify = require('csv-stringify');
const { getCsvData, getName, getJobMeta } = require('../services/rfm-classify');

const exportReportType = 'RFM Classification';
const exportReportJob = `Arbimon Export ${exportReportType} job`

async function collectData (projection_parameters, cb) {
  // Whole body guarded: an early throw here (e.g. res undefined for a
  // nonexistent job id) previously escaped as an UNHANDLED REJECTION and
  // killed the process before the row's error was recorded — the #1759
  // poison-row class, surviving in this file (caught by the 2026-07-23
  // forced-failure E2E). Also: console.err is not a function (same class as
  // the #1759 pattern-matching fixes) — the catch handlers themselves threw.
  try {
    const [res] = await getName(projection_parameters.rfmClassify)
    if (!res || !res.name) {
      return cb(new Error(`classification job ${projection_parameters.rfmClassify} not found`))
    }
    const jobMeta = await getJobMeta(projection_parameters.rfmClassify).catch(() => null)
    const filePath = path.join(__dirname, `rfm_${res.name}.csv`)
    const targetFile = fs.createWriteStream(filePath, { flags: 'a' })
    await exportRFMClassify(projection_parameters.rfmClassify, targetFile, async (err, data) => {
      if (err) {
        console.error('Error export RFM Classification', err)
        targetFile.end()
        return cb(err)
      }
      console.log(`${exportReportJob}: finished collecting chunks`)
      targetFile.end()
      cb(null, path.resolve(filePath), `rfm_${res.name}`, jobMeta)
    }).catch((e) => {
      console.error('Error export RFM Classification', e)
      cb(e)
    })
  } catch (e) {
    console.error('Error export RFM Classification (early)', e)
    cb(e)
  }
}

async function exportRFMClassify (jobId, targetFile, cb) {
  try {
    console.log(`${exportReportJob} started`)
    const limit = 5000;
    let index = 0
    let toProcess = true;
    let isFirstChunk = true

    while (toProcess === true) {
      console.log('next chunk', limit, limit * index)
      const queryResult =  await getCsvData({
        jobId,
        limit,
        offset: limit * index
      });
      toProcess = queryResult.length > 0;
      if (toProcess) {
        console.log(`${exportReportJob}: writing chunk`)
        await writeChunk(queryResult, targetFile, isFirstChunk)
      }
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
  return new Promise(async function (resolve, reject) {
    const fieldsFull = [
      'rec',
      'model presence',
      'threshold presence',
      'current threshold',
      'vector max value',
      'site',
      'year',
      'month',
      'day',
      'hour',
      'minute',
      'species',
      'songtype'
    ];
    const fieldsShort = [
      'rec',
      'presence',
      'site',
      'year',
      'month',
      'day',
      'hour',
      'minute',
      'species',
      'songtype'
    ];
    const thisrow = results[0]
    const isThresholdEmpty = thisrow['current threshold'] === null

    let datastream = new stream.Readable({objectMode: true});
    let _buf = []
    for (let result of results) {
      if (isThresholdEmpty) {
        delete result['current threshold']
        delete result['vector max value']
        result['presence'] = result['model presence']
      } else {
        const maxVal = result['vector max value'];
        let tprec = 0;
        if (maxVal >= result['current threshold']) {
          tprec = 1;
        }
        result['threshold presence'] = tprec
      }
      datastream.push(isThresholdEmpty ? fieldsShort.map(field => result[field]) : fieldsFull.map(field => result[field]))
    }
    datastream.push(null);
    datastream.on('data', (d) => {
        _buf.push(Object.values(d))
    })

    datastream.on('end', async () => {
      csv_stringify(_buf, { header: isFirstChunk, columns: isThresholdEmpty ? fieldsShort : fieldsFull }, async (err, data) => {
        if (err) {
          reject(err)
        }
        targetFile.write(data);
        return resolve();
      })
    })
  })
}

module.exports = {
  collectData
}
