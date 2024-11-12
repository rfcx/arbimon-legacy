require('dotenv').config()
const path = require('path')
const fs = require('fs')
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

async function collectData (filters, projection_parameters, cb) {
  outputStreamFile = fs.createWriteStream(__dirname + '/pattern-matching-export.zip');

  archive.pipe(outputStreamFile)
  await exportAllPmJobs(filters.project_id, projection_parameters, async (err, data) => {
    if (err) {
      console.err('Error export PM', err)
      return cb(err)
    }
    console.log(`${exportReportJob}: before finalizeArchive`)
    await finalizeArchive()
    console.log(`${exportReportJob}: after finalizeArchive`)
    cb(null, null);
  }).catch((e) => {
    console.err('Error export PM', e)
    cb(e)
  })
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
    archive.append(fs.createReadStream(sourceFilePath)
      .on('end', function() {console.log('<- 1. End fileToZipDirectory.', sourceFileName); resolve()})
      .on('error', function(err) {console.log('<- 1. Error fileToZipDirectory.', sourceFileName, err); reject()})
    , { name: sourceFileName })
  });
}

async function exportAllPmJobs (projectId, projection_parameters, cb) {
  try {
    console.log(`${exportReportJob} started`)
    const projectSites = await getProjectSites({projectId})
    const projectPMJobs = await getProjectPMJobs({projectId, jobs: projection_parameters.pmIds})
    await exportAllPmJobsCsv(projectPMJobs)
    for (let job of projectPMJobs) {
      const fileName = `${nameToUrl(job.job_name)}_${job.job_id}.csv`;
      const filePath = path.join(tmpFilePath, fileName)
      const targetFile = fs.createWriteStream(filePath, { flags: 'a' })
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
      targetFile.end()
      console.log('PM job end:', fileName)
      await fileToZipDirectory(filePath, fileName).then(() => {
        fs.unlink(filePath, function(err){
          if(err) return console.error('<- 2. error pm csv delete', fileName, err);
          console.log('<- 2. pm csv deleted successfully', fileName);
        })
      })
    }
    cb(null, null)
  } catch (e) {
    console.error(e)
    cb(null, null)
  }
}

async function exportAllPmJobsCsv (results) {
  const fileName = '_pattern_matching.csv';
  const filePath = path.join(tmpFilePath, fileName)
  const targetFileSummaryData = fs.createWriteStream(filePath, { flags: 'a' })
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
      csv_stringify(_buf, { header: true, columns: fields }, async (err, data) => {
        if (err) {
          reject(err)
        }
        targetFileSummaryData.write(data)
        targetFileSummaryData.end()
        const filePath = tmpFilePath + '/_pattern_matching.csv'
        await fileToZipDirectory(filePath, fileName).then(() => {
          fs.unlink(filePath, function(err) {
            if (err) return console.error('<- 2. error targetFileSummaryData delete', fileName, err);
            console.log('<- 2. targetFileSummaryData deleted successfully', fileName);
          })
        })
        resolve()
      })
    })
  })
}

async function writeChunk (results, targetFile, projectSites, isFirstChunk) {
  return new Promise(async function (resolve, reject) {
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
        const recUrl = recs.filter(r => r.recording_id === result.recording_id)[0].uri;
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
          console.log('targetFile write', _buf.length)
          targetFile.write(data);
          return resolve();
        })
      })
  })
}

module.exports = {
  collectData
}

