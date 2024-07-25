require('dotenv').config()
const path = require('path')
const { getProjectTemplate, getTemplateDataForAudio } = require('../services/template')
const fs = require('fs')
const stream = require('stream');
const csv_stringify = require('csv-stringify');
const { zipDirectory } = require('../services/file-helper')
const recordings = require('../../app/model/recordings')

const exportReportType = 'Template';
const exportReportJob = `Arbimon Export ${exportReportType} job`
const tmpFilePath = 'jobs/arbimon-recording-export-job/tmpfilecache'

async function collectData (projection_parameters, filters, cb) {
  let isFirstChunk = true
  const filePath = path.join(tmpFilePath, '_templates.csv')
  const targetFile = fs.createWriteStream(filePath, { flags: 'a' })
  // 1. Export .csv file
  await exportAllProjectTemplate(filters.project_id, projection_parameters.projectUrl, async (e, data) => {
    if (e) {
      targetFile.end()
      return cb(e)
    }
    if (data) {
      console.log(`${exportReportJob}: finished collecting chunks`)
      await writeChunk(data, targetFile, isFirstChunk)
    }
    isFirstChunk = false
    targetFile.end()
    // 2. Export audio files
    await exportAllProjectTemplate(filters.project_id, projection_parameters.projectUrl, async (e, data) => {
      await downloadTemplateAudio(data)
      cb(null, path.resolve(filePath))
    })
  }).catch((e) => {
    cb(e)
  })
}

async function buildTemplateFolder() {
    await zipDirectory(tmpFilePath, 'jobs/arbimon-recording-export-job/template-export.zip')
}

async function exportAllProjectTemplate (projectId, projectUrl, cb) {
  try {
    console.log('arbimon-export-all-project-template-rois job started')
  
    const limit = 10000;
    let index = 0
    let toProcess = true;
    let results = [];

    while (toProcess === true) {
      const queryResult =  await getProjectTemplate({
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

function nameToUrl (name) {
  return name.replace(/[^a-z0-9A-Z-]/g, '-').replace(/-+/g,'-').replace(/(^-)|(-$)/g, '').toLowerCase()
}

async function writeChunk (results, targetFile, isFirstChunk) {
  return new Promise(function (resolve, reject) {
      let fields = [];
      results.forEach(result => {
          fields.push(...Object.keys(result).filter(f => !fields.includes(f)))
      });

      let datastream = new stream.Readable({objectMode: true});
      let _buf = []

      for (let result of results) {
        fields.forEach(f => {
          const saved_filename = `${nameToUrl(result.template_name)}-${result.template_id}.wav`;
          result.saved_filename = saved_filename
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
            console.log('Err write to csv file.', err)
            reject(err)
          }
          targetFile.write(data)
          resolve()
        })
      })
  })
}

async function downloadTemplateAudio (results) {
  return new Promise(async function (resolve, reject) {
    if (!results) resolve()
    console.log('--template length', results.length)
    for (let result of results) {
      console.log('--template data', result)
      const templateId = result.template_id
      try {
        const template = await getTemplateDataForAudio({ templateId: templateId})
        console.log('template', template)
        const opts = {
          uri: template.recUri,
          site_id: template.recSiteId,
          external_id: template.external_id,
          datetime: template.datetime,
          datetime_utc: template.datetime_utc
        }
        const filter = {
          maxFreq: Math.max(template.y1, template.y2),
          minFreq: Math.min(template.y1, template.y2),
          gain: 5,
          trim: {
              from: Math.min(template.x1, template.x2),
              to: Math.max(template.x1, template.x2)
          },
          format: '.wav'
        }
        await recordings.fetchAudioFileAsync(opts, filter).then(audio => {
          console.log('fetchAudioFileAsync', audio)
          const ext = path.extname(audio.path)
          const audioName = path.basename(audio.path, ext);
          const saved_filename = `${nameToUrl(result.template_name)}-${templateId}`
          const newName = audio.path.replace(audioName, saved_filename);
          console.log('fetchAudioFileAsync audio.path, newName', audio.path, saved_filename)
          fs.renameSync(audio.path, newName);
          console.log('fetchAudioFileAsync renamed')
        })
      } catch (err) {
        console.log('Err download template audio.', err)
        continue
      }
    }
    resolve()
  })
}

module.exports = {
  collectData,
  buildTemplateFolder
}

