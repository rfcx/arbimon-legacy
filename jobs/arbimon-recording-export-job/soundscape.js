require('dotenv').config()
const path = require('path')
const fs = require('fs')
const stream = require('stream');
const csv_stringify = require('csv-stringify');
const q = require('q');
const scidx = require('../../app/utils/scidx');
const soundscapes = require('../../app/model/soundscapes');
const { getSoundscapesForCSV, getProjectSoundscapes } = require('../services/soundscape');
const { zipDirectory } = require('../services/file-helper')
const { getObject } = require('../services/storage')

const S3_LEGACY_BUCKET_ARBIMON = process.env.AWS_BUCKETNAME

const exportReportType = 'Soundscape';
const exportReportJob = `Arbimon Export ${exportReportType} job`
const tmpFilePath = 'jobs/arbimon-recording-export-job/tmpfilecache'

async function collectData (projection_parameters, filters, cb) {
  const filePath = path.join(tmpFilePath, `_soundscape.csv`)
  const targetFile = fs.createWriteStream(filePath, { flags: 'a' })
   // 1. Export .csv file
  await exportAllSoundscapes(filters.project_id, projection_parameters.projectUrl, targetFile, async (err, data) => {
    if (err) {
      console.err(`Error export ${exportReportType}`, err)
      targetFile.end()
      return cb(err)
    }
    console.log(`${exportReportJob}: finished collecting chunks`)
    targetFile.end()
    // 2. Export matrix and images
    const soundscapes = await getProjectSoundscapes({ projectId: filters.project_id })
    await getProjectSoundscapesMatrixData(soundscapes)
    await getProjectSoundscapesImages(soundscapes)
    cb(null, path.resolve(filePath))
  }).catch((e) => {
    console.err(`Error export ${exportReportType}`, e)
    cb(e)
  })
}

async function buildSoundscapeFolder() {
  await zipDirectory(tmpFilePath, 'jobs/arbimon-recording-export-job/soundscape-export.zip')
}

async function exportAllSoundscapes (projectId, projectUrl, targetFile, cb) {
  try {
    console.log(`${exportReportJob} started`)
  
    const limit = 10000;
    let index = 0
    let toProcess = true;
    let isFirstChunk = true

    while (toProcess === true) {
      console.log('next chunk', limit, limit * index)
      const queryResult =  await getSoundscapesForCSV({
        projectId,
        projectUrl,
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

async function getProjectSoundscapesMatrixData(soundscapes) {
  for (let soundscape of soundscapes) {
    soundscape.aggregation = {
      id: soundscape.aggregation,
      name: soundscape.aggr_name,
      scale: JSON.parse(soundscape.aggr_scale)
    };
    console.log('soundscape matrix', soundscape)
    await getMatrixData(soundscape)
    fs.unlink(tempPathToDelete, () => {})
  }
}

async function getProjectSoundscapesImages(soundscapes) {
  for (let soundscape of soundscapes) {
    console.log('soundscape  image', soundscape)
    await getImageData(soundscape)
  }
}

function nameToUrl (name) {
  return name.replace(/[^a-z0-9A-Z-]/g, '-').replace(/-+/g,'-').replace(/(^-)|(-$)/g, '').toLowerCase()
}

async function getMatrixData(soundscape) {
  const filename = `${nameToUrl(soundscape.name)}-${soundscape.id}.csv`;
  const filePath = path.join(tmpFilePath, filename)
  const targetFile = fs.createWriteStream(filePath, { flags: 'a' })

  function dumpSCIDXMatrix(scidx) {
    let cols = [];
    let matrix = [];
    let x,y;
    for (x=0; x < scidx.width; ++x) {
      cols.push(scidx.offsetx + x);
    }
    for (y=0; y < scidx.height; ++y) {
      let row = [];
      for (x=0; x < scidx.width; ++x) {
        row.push(0);
      }
      matrix.push(row);
    }
    let threshold = soundscape.threshold;

    return q.resolve().then(function(){
      if(soundscape.threshold_type == 'relative-to-peak-maximum'){
        let maxAmp=0;
        return q.all(Object.keys(scidx.index).map(function(freq_bin){
          let row = scidx.index[freq_bin];
          return q.all(Object.keys(row).map(function(time){
            let recs = row[time][0];
            let amps = row[time][1];
            return q.all(recs.map(function(rec_idx, c_idx){
              let amp = amps && amps[c_idx];
              if(maxAmp <= amp){
                maxAmp = amp;
              }
            }));
          }));
        })).then(function(){
          threshold *= maxAmp;
        });
      }
    }).then(function(){
      Object.keys(scidx.index).map(function(freq_bin) {
        let row = scidx.index[freq_bin];
        Object.keys(row).map(function(time){
          let recs = row[time][0];
          let amps = row[time][1];
          if(!threshold){
            matrix[freq_bin - scidx.offsety][time - scidx.offsetx] += recs.length;
          } else {
            recs.map(function(rec_idx, c_idx) {
              let amp = amps && amps[c_idx];
              if(amp && amp > threshold){
                matrix[freq_bin - scidx.offsety][time - scidx.offsetx]++;
              }
            });
          }
        });
      });
    }).then(function() {
      if (soundscape.normalized) {
        return soundscapes.fetchNormVector(soundscape).then(function(normvec) {
          for(x=0; x < scidx.width; ++x) {
            key = '' + (x + scidx.offsetx);
            if(key in normvec){
              let val = normvec[key];
              for(y=0; y < scidx.height; ++y) {
                matrix[y][x] = matrix[y][x] * 1.0 / val;
              }
            }
          }
        });
      }
    }).then(function() {
      let fields = ['freq-min','freq-max'].concat(cols);
      let datastream = new stream.Readable({objectMode: true});
      let _buf = [];

      for (y=matrix.length-1; y > -1; --y) {
        let row = matrix[y];
        let freq = (scidx.offsety + y) * soundscape.bin_size;
        datastream.push([freq, freq + soundscape.bin_size].concat(row))
      }
      datastream.push(null);

      datastream.on('data', (d) => {
        _buf.push(Object.values(d))
      })
      datastream.on('end', async () => {
        csv_stringify(_buf, { header: true, columns: fields }, async (err, data) => {
          if (err) {
            console.log('Err write to csv file.', err)
            reject(err)
          }
          targetFile.write(data)
          return targetFile.end()
        })
      })
    });
  }
  await fetchSCIDX(soundscape).then(dumpSCIDXMatrix)
}

async function fetchSCIDX(soundscape) {
  return soundscapes.fetchSCIDXFile(soundscape).then(function(scidx_path) {
    console.log('scidx_path', scidx_path)
    tempPathToDelete = scidx_path.path
    const idx = new scidx();
    return q.ninvoke(idx, 'read', scidx_path.path)
  })
}

async function getImageData(soundscape) {
  const filename = `${nameToUrl(soundscape.name)}-${soundscape.id}.png`;
  const filePath = path.join(tmpFilePath, filename)
  const  s3Data = await getObject({ Bucket: S3_LEGACY_BUCKET_ARBIMON, Key: soundscape.uri, isLegacy: true });
  fs.writeFileSync(filePath, s3Data)
}

module.exports = {
  collectData,
  buildSoundscapeFolder
}

