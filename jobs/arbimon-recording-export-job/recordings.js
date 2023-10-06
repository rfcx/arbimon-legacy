const recordings = require('../../app/model/recordings')
const fs = require('fs')
const stream = require('stream');
const csv_stringify = require('csv-stringify');
const config_hosts = require('../../config/hosts');
const path = require('path')

async function collectData (projection_parameters, filters, cb) {
  let isFirstChunk = true
  const filePath = path.join('./', `${(new Date()).toISOString()}.csv`)
  const targetFile = fs.createWriteStream(filePath, { flags: 'a' })
  await recordings.exportRecordingData(projection_parameters, filters, async (e, data) => {
    if (e) {
      targetFile.end()
      return cb(e)
    }
    if (data) {
      console.log('arbimon-recording-export job: writing chunk')
      await writeChunk(data, projection_parameters.projectUrl, targetFile, isFirstChunk)
      isFirstChunk = false
    } else {
      console.log('arbimon-recording-export job: finished collecting chunks')
      targetFile.end()
      cb(null, path.resolve(filePath))
    }
  }).catch((e) => {
    cb(e)
  })
}

// Process the Export recordings report and send the email
async function writeChunk (results, projectUrl, targetFile, isFirstChunk) {
  return new Promise(function (resolve, reject) {
      let fields = [];
      results.forEach(result => {
          fields.push(...Object.keys(result).filter(f => !fields.includes(f)))
      });
      const metaIndex = fields.indexOf('meta');
      if (metaIndex !== -1) {
          fields.splice(metaIndex, 1);
      }
      let colOrder= { filename: -6, site: -5, time: -4, day: -4, month: -3, year: -2, hour: -1, date: 0 };
      function sort (array) {
          array.sort(function(a, b){
              const ca = colOrder[a] || 0, cb = colOrder[b] || 0;
              return ca < cb ? -1 : (
                  ca > cb ?  1 : (
                      a <  b ? -1 : (
                      a >  b ?  1 :
                      0
              )));
          });
      }
      sort(fields)

      let datastream = new stream.Readable({objectMode: true});
      let _buf = []

      for (let row of results) {
          if (row.meta && row.filename) {
              try {
                  const parsedMeta = JSON.parse(row.meta);
                  row.filename = parsedMeta && parsedMeta.filename? parsedMeta.filename :  row.filename;
              } catch (e) {}
          }
          delete row.meta;
          if (row.url) {
              row.url = `${config_hosts.publicUrl}/legacy-api/project/${projectUrl}/recordings/download/${row.url}`;
          }
          // Fill a specific label for each cell without validations data.
          fields.forEach(f => {
              if (row[f] === undefined || row[f] === null) {
                  row[f] = '---'}
              }
          )
          // Sort data to follow the header
          const sorted = Object.keys(row)
              .sort(function(a, b){
                  const ca = colOrder[a] || 0, cb = colOrder[b] || 0;
                  return ca < cb ? -1 : (
                      ca > cb ?  1 : (
                          a <  b ? -1 : (
                          a >  b ?  1 :
                          0
                  )));
              })
              .reduce(
                  (obj, key) => ({
                  ...obj,
                  [key]: row[key]
                  }),
                  {}
              )

          datastream.push(sorted);
      };
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
