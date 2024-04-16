require('dotenv').config()
const path = require('path')
const { getProjectTemplate, getTemplateDataForAudio } = require('../services/template')
const fs = require('fs')
const stream = require('stream');
const csv_stringify = require('csv-stringify');
const { zipDirectory } = require('../services/file-helper')
const recordings = require('../../app/model/recordings')

async function collectData (projection_parameters, filters, cb) {
  let isFirstChunk = true
  const filePath = path.join('./tmpfilecache', `${(new Date()).toISOString()}.csv`)
  const targetFile = fs.createWriteStream(filePath, { flags: 'a' })
  await exportAllProjectTemplate(filters.project_id, projection_parameters.projectUrl, async (e, data) => {
    if (e) {
      targetFile.end()
      return cb(e)
    }
    if (data) {
      console.log('Arbimon Export project template job: writing chunk')
      await writeChunk(data, targetFile, isFirstChunk)
    }
    isFirstChunk = false
    console.log('Arbimon Export project template job: finished collecting chunks')
    targetFile.end()
    cb(null, path.resolve(filePath))
  }).catch((e) => {
    cb(e)
  })
}

async function buildTemplateFolder() {
    await zipDirectory('./tmpfilecache', './tmpfilecache/template-export.zip')
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

async function writeChunk (results, targetFile, isFirstChunk) {
  return new Promise(async function (resolve, reject) {
      let fields = [];
      results.forEach(result => {
          fields.push(...Object.keys(result).filter(f => !fields.includes(f)))
      });

      const templateId = fields.indexOf('template_id');
        if (templateId !== -1) {
            fields.splice(templateId, 1);
        }

      let datastream = new stream.Readable({objectMode: true});
      let _buf = []

      for (let result of results) {
        fields.forEach(async (f) => {
          if (result[f] === undefined || result[f] === null) {
              result[f] = '---'}
            }
        )
        const templateId = result.template_id
        delete result.template_id

        await getTemplateDataForAudio({ templateId: templateId})
        .then(async template => {
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
            const newName = audio.path.replace(audioName, result.name);
            fs.renameSync(audio.path, newName);
          })
        })
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

module.exports = {
  collectData,
  buildTemplateFolder
}

