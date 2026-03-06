require('dotenv').config()
const path = require('path')
const fs = require('fs')
const stream = require('stream');
const csv_stringify = require('csv-stringify');
const { getCsvData, getName } = require('../services/rfm-classify');

const exportReportType = 'RFM Classification';
const exportReportJob = `Arbimon Export ${exportReportType} job`

async function collectData (projection_parameters, cb) {
  const [res] = await getName(projection_parameters.rfmClassify)
  const filePath = path.join(__dirname, `${res.name}.csv`)
  const targetFile = fs.createWriteStream(filePath, { flags: 'a' })
  await exportRFMClassify(projection_parameters.rfmClassify, targetFile, async (err, data) => {
    if (err) {
      console.err('Error export RFM Classification', err)
      targetFile.end()
      return cb(err)
    }
    console.log(`${exportReportJob}: finished collecting chunks`)
    targetFile.end()
    cb(null, path.resolve(filePath))
  }).catch((e) => {
    console.err('Error export RFM Classification', e)
    cb(e)
  })
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

      console.log(`${exportReportJob}: writing chunk`)
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
  return new Promise(async function (resolve, reject) {
    let fields = [];
    results.forEach(result => {
      fields.push(...Object.keys(result).filter(f => !fields.includes(f)))
    });
    fields.splice(2, 0, 'threshold presence');

    let datastream = new stream.Readable({objectMode: true});
    let _buf = []

    for (let result of results) {
      _buf.push(result);
    }
    datastream.on('data', (d) => {
      _buf.push(d);
    })
    for (let result of _buf) {
      fields.forEach(f => {
        if (result[f] === undefined || result[f] === null) {
          result[f] = '---'}
        }
      )
      const maxVal = result['vector max value'];
      let tprec = 0;
      if (maxVal >= result['current threshold']) {
        tprec = 1;
      }
      result['threshold presence'] = tprec
      datastream.push(result)
    }
    datastream.push(null);

    datastream.on('end', async () => {
      csv_stringify(_buf, { header: isFirstChunk, columns: fields }, async (err, data) => {
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

