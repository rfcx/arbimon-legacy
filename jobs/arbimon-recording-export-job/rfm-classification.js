require('dotenv').config()
const path = require('path')
const fs = require('fs')
const stream = require('stream');
const csv_stringify = require('csv-stringify');
const { getCsvData, getName, getJobMeta } = require('../services/rfm-classify');
const { sanitizeFilename } = require('../services/file-helper');

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
    // res.name derives from the classification job's user-typed name (getName
    // lowercases it and turns spaces into underscores — but leaves every other
    // character). A '/' in it turns the csv target into a SUBDIRECTORY, the
    // WriteStream open fails ENOENT, and the unhandled 'error' event kills the
    // whole consumer process — the measured 2026-09-12 crash-loop (job names
    // like "S. fuscovarius 80/20 B2" -> 'rfm_s._fuscovarius_80/20_b2.csv').
    // Sanitize HERE, at path-construction time; the raw readable name still
    // reaches the user via jobMeta.job_name in the notification email.
    const safeName = sanitizeFilename(res.name)
    const filePath = path.join(__dirname, `rfm_${safeName}.csv`)
    const targetFile = fs.createWriteStream(filePath, { flags: 'a' })
    // A WriteStream 'error' with no listener is an UNHANDLED EVENT that throws
    // out of the event loop and kills the consumer (node:events
    // "Emitted 'error' event on WriteStream instance") — one bad export must
    // fail its own row only. Capture the failure and surface it through cb()
    // so the caller marks the export row failed and the queue advances.
    const state = { streamError: null }
    targetFile.on('error', (err) => {
      console.error('Error export RFM Classification (write stream)', err)
      if (!state.streamError) state.streamError = err
    })
    // Deterministic open gate: the fd open completes on the thread pool, so an
    // open failure (the ENOENT class) lands on a LATER tick than the first
    // export-loop iterations. Wait for 'open' or the first 'error' BEFORE
    // pulling any chunks, so an unwritable target fails the row immediately
    // instead of racing the loop (or, worse, reporting success on a file that
    // was never created).
    await new Promise((resolve) => {
      targetFile.once('open', resolve)
      targetFile.once('error', resolve)
    })
    await exportRFMClassify(projection_parameters.rfmClassify, targetFile, async (err, data) => {
      if (state.streamError) {
        // The stream failed at/before write time. Fail the row, never the
        // process; the reconciler will not re-pick a terminal-error row.
        try { targetFile.destroy() } catch (_) {}
        return cb(state.streamError)
      }
      if (err) {
        console.error('Error export RFM Classification', err)
        targetFile.end()
        return cb(err)
      }
      console.log(`${exportReportJob}: finished collecting chunks`)
      targetFile.end()
      cb(null, path.resolve(filePath), `rfm_${safeName}`, jobMeta)
    }, state).catch((e) => {
      console.error('Error export RFM Classification', e)
      cb(e)
    })
  } catch (e) {
    console.error('Error export RFM Classification (early)', e)
    cb(e)
  }
}

async function exportRFMClassify (jobId, targetFile, cb, state) {
  try {
    console.log(`${exportReportJob} started`)
    const limit = 5000;
    let index = 0
    let toProcess = true;
    let isFirstChunk = true

    // A dead stream is terminal for this export: stop pulling chunks from the
    // DB (the writes would no-op anyway) and let the callback report the
    // recorded streamError.
    while (toProcess === true && !(state && state.streamError)) {
      console.log('next chunk', limit, limit * index)
      const queryResult =  await getCsvData({
        jobId,
        limit,
        offset: limit * index
      });
      toProcess = queryResult.length > 0;
      if (toProcess && !(state && state.streamError)) {
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
