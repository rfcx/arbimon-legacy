require('dotenv').config()
const db = require('../db')
const fs = require('fs')
const stream = require('stream');
const csv_stringify = require('csv-stringify');
const mandrill = require('mandrill-api/mandrill')
const moment = require('moment')
const { exportOccupancyModels, getExportRecordingsRow, getCountSitesRecPerDates, updateExportRecordings, getCountConnections } = require('../services/recordings')
const { errorMessage } = require('../services/stats')
const recordings = require('../../app/model/recordings')
const clusterings = require('../../app/model/clustering-jobs')
const projects = require('../../app/model/projects')
const config_hosts = require('../../config/hosts');
const { saveLatestData, combineFilename, uploadAsStream, getSignedUrl, uploadFileToS3 } = require('../services/storage')
const recordingsExport = require('./recordings')
const patternMatching = require('./pattern-matching')
const soundscape = require('./soundscape')
const template = require('./template')
const { streamToBuffer, zipDirectory } = require('../services/file-helper')

const S3_EXPORT_BUCKET_ARBIMON = process.env.S3_BUCKET_ARBIMON

const tmpFilePath = 'jobs/arbimon-recording-export-job/tmpfilecache'

async function main () {
  try {
    console.log('Arbimon export job started.')

    const countConnections = await getCountConnections()
    if (countConnections > 10) {
        console.log('Arbimon export job stopped due to high mysql db connections count.')
        return
    }

    let filters, projection_parameters
    const currentTime = moment.utc().format('YYYY-MM-DD HH:mm:ss')
    const limit = 1
    const [rowData] =  await getExportRecordingsRow({
        currentTime,
        limit
    })

    if (!rowData) {
        console.log('Arbimon export job has not any new export report.')
        return
    }

    console.log(`\n\n project = ${ rowData.name }`)

    const message = `project = ${ rowData.name } [${ rowData.project_id }] ${ rowData.created_at }`
    const jobName = 'Arbimon Export job'
    try {
        filters = JSON.parse(rowData.filters)
        projection_parameters = JSON.parse(rowData.projection_parameters)
    } catch (error) {
        console.error('Error parse params of Arbimon export job.', error)
        await updateExportRecordings(rowData, { error: JSON.stringify(error) })
        await errorMessage(message, jobName)
        return
    }

    //----------------Arbimon export Clustering report----------------
    if (projection_parameters && projection_parameters.aed) {
        let params = projection_parameters
        params.project_id = filters.project_id
        params.exportReport = true
        const data = await clusterings.findRois(params)
        return processClusteringStream(params.cluster, data, rowData, currentTime, message, jobName, projection_parameters.projectUrl).then(async () => {
            console.log(`Arbimon Export job finished: clustering report for ${message}`)
        })
    } else if (projection_parameters && projection_parameters.grouped && projection_parameters.validation) {
        //----------------Arbimon export Grouped detections report----------------
        let allData
        // Get all sites, data, hours for selected project.
        if (projection_parameters.grouped === 'site') {
            projects.getProjectSites(filters.project_id).then(function(rows) {
                allData = rows.map(s=>s.name)
            })
        }
        if (projection_parameters.grouped === 'date') {
            await projects.getProjectDates(filters.project_id, "%Y/%m/%d").then(function(rows) {
                allData = rows.map(r=>r.date)
            })
        }
        if (projection_parameters.grouped === 'hour') {
            await projects.getProjectDates(filters.project_id, "%H").then(function(rows) {
                allData = rows.map(r=>r.date)
            })
        }
        const data = await recordings.groupedDetections(projection_parameters, filters)
        return processGroupedDetectionsStream(data, rowData, projection_parameters, allData, currentTime, message, jobName).then(async () => {
            console.log(`Arbimon Export job finished: grouped detections report for ${message}`)
        })
    } else if (projection_parameters && projection_parameters.species) {
        //----------------Arbimon export Occupancy model----------------
        // Create the Occupancy model csv files, put them to .zip folder a send the folder to the user email
        await getMultipleOccupancyModelsData(projection_parameters, filters, rowData, currentTime, message, jobName)
    } else if (projection_parameters && (projection_parameters.pmAll || projection_parameters.pmIds)) {
        //----------------Arbimon export all project PM jobs----------------
        return new Promise((resolve, reject) => {
            const exportReportType = 'Pattern Matchings';
            console.log(`Arbimon Export ${exportReportType} job`)
            patternMatching.collectData(filters, projection_parameters, async (err, filePath) => {
                const reportName = 'pattern-matching-export'
                const zipPath = `jobs/arbimon-recording-export-job/${reportName}.zip`
                const bucketFormatted = S3_EXPORT_BUCKET_ARBIMON.split('/')[0]
                const s3filePath = await uploadFileToS3(bucketFormatted, zipPath, rowData.project_id, currentTime, reportName, '.zip')
                console.log('--s3filePath', s3filePath)
                const url = await getSignedUrl({ Bucket: bucketFormatted, Key: s3filePath })
                console.log('--signed url', url)
                await sendEmail('Arbimon export', 'Arbimon export', rowData, url, true)
                await updateExportRecordings(rowData, { processed_at: currentTime })
                fs.rmSync(tmpFilePath, { recursive: true, force: true });
                console.log(`Arbimon Export ${exportReportType} job finished: ${message}`)
                resolve()
            })
        })
    }   else if (projection_parameters && projection_parameters.projectTemplate) {
            //----------------Arbimon export all project templates----------------
            return new Promise((resolve, reject) => {
                const exportReportType = 'Templates';
                console.log(`Arbimon Export ${exportReportType} job`)
                try {
                    if (!fs.existsSync(tmpFilePath)) {
                        fs.mkdirSync(tmpFilePath);
                    }
                } catch (err) {
                    console.error(err);
                }
                console.log(`folder ${tmpFilePath} exists`, fs.existsSync(tmpFilePath))
                template.collectData(projection_parameters, filters, async (err, filePath) => {
                    await template.buildTemplateFolder()
                    await sendZipFolderToTheUser(rowData, currentTime, jobName, message, 'template-export')
                    console.log(`Arbimon Export ${exportReportType} job finished: export templates for ${message}`)
                    resolve()
                })
            })
    }   else if (projection_parameters && projection_parameters.soundscapes) {
        //----------------Arbimon export all project soundscapes----------------
        return new Promise((resolve, reject) => {
            const exportReportType = 'Soundscapes';
            console.log(`Arbimon Export ${exportReportType} job`)
            soundscape.collectData(projection_parameters, filters, async (err, filePath) => {
                console.log('--start buildSoundscapeFolder', filePath);
                await soundscape.buildSoundscapeFolder()
                console.log('--end buildSoundscapeFolder');
                await sendZipFolderToTheUser(rowData, currentTime, jobName, message, 'soundscape-export')
                console.log(`Arbimon Export ${exportReportType} job finished: export soundscapes for ${message}`)
                resolve()
            })
        })
    }   else {
        //----------------Arbimon export recordings----------------
        return new Promise((resolve, reject) => {
            recordingsExport.collectData(projection_parameters, filters, async (err, filePath) => {
                if (err) {
                    console.error('Arbimon Export job error', err)
                    fs.unlink(filePath, () => {})
                    reject(err)
                }
                console.log('Arbimon Export job: uploading file to S3')
                const url = await saveFile(filePath, currentTime, rowData.project_id)
                console.log('Arbimon Export job: file is accessible by url', url)
                await sendEmail('Arbimon Export recording report', 'arbimon-export-recording.csv', rowData, url, true)
                await updateExportRecordings(rowData, { processed_at: currentTime })
                fs.unlink(filePath, () => {})
                console.log(`Arbimon Export job finished: export recordings report for ${message}`)
                resolve()
            })
        })
    }
  } catch (e) {
    console.error(e)
  }
}

async function saveFile (filePath, currentTime, projectId) {
    const s3FileKey = combineFilename(currentTime, projectId, 'arbimon-export-report', '.csv')
    await uploadAsStream({ filePath, Bucket: S3_EXPORT_BUCKET_ARBIMON, Key: s3FileKey, ContentType: 'text/csv' })
    return await getSignedUrl({ Bucket: S3_EXPORT_BUCKET_ARBIMON, Key: s3FileKey })
}

// Process Clustering report and send the email
async function processClusteringStream (cluster, results, rowData, currentTime, message, jobName, projectUrl) {
    return new Promise(function (resolve, reject) {
        console.log('total results length', results.length)
        let _buf = []
        let fields = [];
        fields.push(...Object.keys(results[0]))
        fields.push('cluster')
        let datastream = new stream.Readable({objectMode: true});
        results.forEach(result => {
            datastream.push(result)
        });
        datastream.push(null);
        datastream.on('data', (d) => {
            for (let row in cluster) {
                if (d.recording_id) {
                    d.uri = `${config_hosts.publicUrl}/legacy-api/project/${projectUrl}/recordings/download/${d.recording_id}`;
                }
                if (cluster[row].includes(d.aed_id)) {
                    d.cluster = row
                }
            }
            _buf.push(Object.values(d))
        })
        datastream.on('end', async () => {
            csv_stringify(_buf, { header: true, columns: fields }, async (err, data) => {
                const content = Buffer.from(data).toString('base64')
                const contentSize = Buffer.byteLength(content)
                const isBigContent = contentSize && contentSize > 10240 // 10MB
                if (isBigContent) {
                    const filePath = await saveLatestData(S3_EXPORT_BUCKET_ARBIMON, data, rowData.project_id, currentTime, 'clustering-rois-export', '.csv', 'text/csv')
                    const url = await getSignedUrl({ Bucket: S3_EXPORT_BUCKET_ARBIMON, Key: filePath })
                    await sendEmail('Arbimon Export clustering report', null, rowData, url, true)
                }
                try {
                    if (!isBigContent) {
                        await sendEmail('Arbimon Export clustering report', 'clustering-rois-export.csv', rowData, content, false)
                    }
                    await updateExportRecordings(rowData, { processed_at: currentTime })
                    resolve()
                } catch(error) {
                    console.error('Error while sending clustering-rois-export email', error)
                    await errorMessage(message, jobName)
                    await updateExportRecordings(rowData, { error: JSON.stringify(error) })
                    resolve()
                }
            })
        })

    })
}

// Process the Occupancy model report and send the email
async function getMultipleOccupancyModelsData(projection_parameters, filters, rowData, currentTime, message, jobName) {
    if (!fs.existsSync(tmpFilePath, { recursive: true })) {
        fs.mkdirSync(tmpFilePath);
    }
    console.log(`[getMultipleOccupancyModelsData] folder ${tmpFilePath} exists`, fs.existsSync(tmpFilePath))
    for (const [i, specie] of projection_parameters.species.entries()) {
        const data = await exportOccupancyModels(specie, filters)
        rowData.species_name = filters.species_name[i] || specie
        console.log('[getMultipleOccupancyModelsData] specie', rowData.species_name)
        await processOccupancyModelStream(data, rowData, specie, filters).then(async () => {
            console.log(`occupancy models report for ${message}, specie ${rowData.species_name}`)
        })
    }
    console.log('[getMultipleOccupancyModelsData] before buildOccupancyFolder')
    await buildOccupancyFolder()
    console.log('[getMultipleOccupancyModelsData] after buildOccupancyFolder')
    await sendZipFolderToTheUser(rowData, currentTime, jobName, message, 'occupancy-export')
}

async function buildOccupancyFolder() {
    await zipDirectory(tmpFilePath, 'jobs/arbimon-recording-export-job/occupancy-export.zip')
}

async function sendZipFolderToTheUser(rowData, currentTime, jobName, message, reportName) {
    await streamToBuffer(reportName).then(async (buffer) => {
        try {
            console.log(S3_EXPORT_BUCKET_ARBIMON, buffer, buffer.length, rowData.project_id, currentTime, reportName, '.zip', 'application/zip')
            const filePath = await saveLatestData(S3_EXPORT_BUCKET_ARBIMON, buffer, rowData.project_id, currentTime, reportName, '.zip', 'application/zip')
            const url = await getSignedUrl({ Bucket: S3_EXPORT_BUCKET_ARBIMON, Key: filePath })
            console.log('--signed url', url)
            await sendEmail('Arbimon export', 'Arbimon export', rowData, url, true)
            await updateExportRecordings(rowData, { processed_at: currentTime })
            fs.rmSync(tmpFilePath, { recursive: true, force: true });
        } catch(error) {
            console.error('Error while sending zip folder email.', error)
            await errorMessage(message, jobName)
            fs.rmSync(tmpFilePath, { recursive: true, force: true });
            await updateExportRecordings(rowData, { error: JSON.stringify(error) })
        }
    })
}

async function processOccupancyModelStream (results, rowData, speciesId, filters) {
    return new Promise(async function (resolve, reject) {
        let sitesData = await getCountSitesRecPerDates(rowData.project_id, filters);
        let allSites = sitesData.map(item => { return item.site }).filter((v, i, s) => s.indexOf(v) === i);
        console.log('[processOccupancyModelStream] sites length', allSites.length)
        // Get the first/last recording/date per project, not include invalid dates.
        let dates = sitesData
            .filter(s => s.year && s.month && s.day && s.year > '1970')
            .map(s => new Date(`${s.year}/${s.month}/${s.day}`).valueOf())
        let maxDate = new Date(Math.max(...dates));
        let minDate = new Date(Math.min(...dates));
        let fields = [];
        while (minDate <= maxDate) {
            fields.push(moment(minDate).format('YYYY/MM/DD'));
            minDate = new Date(minDate.setDate(minDate.getDate() + 1));
        };
        let streamObject = {};
        for (let row of results) {
            // Combine repeating sites with existing data in the report.
            if (streamObject[row.site]) {
                let index = fields.findIndex(date => date === row.date);
                streamObject[row.site][index+2] = row.count === 0 ? 0 : 1;
            }
            else {
                let tempRow = {};
                // Fill each cell in the report.
                fields.forEach((item) => {
                    tempRow.site = row.site;
                    tempRow.siteId = row.siteId;
                    let site = sitesData.find(site => {
                        if (site.site === row.site) {
                            return item === moment(new Date(`${site.year}/${site.month}/${site.day}`)).format('YYYY/MM/DD');
                        }
                    });
                    // Occupancy parameter:
                    // 1 (present); 0 (absent);
                    // NA ( device was not active in that day, in other words, there are no recordings for this day);
                    // NI ( no information from the user if species is present or absent). Changed to 0
                    tempRow[item] = item === row.date? (row.count === '0' ? 0 : 1) : (site ? '0' : 'NA');
                });
                streamObject[row.site] = [...Object.values(tempRow)];
            }
        };
        // Get sites without validations.
        let notValidated = allSites.filter(site => !results.find(res => site === res.site ));
        if (notValidated && notValidated.length) {
            for (let row of notValidated) {
                let notValidatedRow = {};
                fields.forEach((item) => {
                    notValidatedRow.site = row;
                    let site = sitesData.find(site => {
                        if (site.site === row) {
                            notValidatedRow.siteId = site.siteId;
                            return item === moment(new Date(`${site.year}/${site.month}/${site.day}`)).format('YYYY/MM/DD');
                        }
                    });
                    notValidatedRow[item] = site ? '0' : 'NA';
                });
                streamObject[row] = [...Object.values(notValidatedRow)];
            }
        }
        fields.unshift('site', 'siteId');
        let datastreamOccupancy = new stream.Readable({objectMode: true});

        let _bufer = []

        datastreamOccupancy.on('data', (d) => {
            console.log('[occupancy datastream data]', d.length)
            _bufer.push(d)
        })
        for (let r of Object.values(streamObject)) {
            console.log('[occupancy split streamObject]', r.length)
            datastreamOccupancy.push(r);
        }
        datastreamOccupancy.push(null);

        datastreamOccupancy.on('end', async () => {
            const title = 'occupancy-' + rowData.species_name + '-' + speciesId + '.csv';
            console.log('[occupancy datastream end] title', title)
            console.log(`[occupancy datastream end] _bufer.length`, _bufer.length)
            const targetFile = fs.createWriteStream(`${tmpFilePath}/${title}`, { flags: 'a' })
            csv_stringify(_bufer, { header: true, columns: fields }, async (err, data) => {
                if (err) {
                    console.log('Err write to csv file.', err)
                    reject(err)
                  }
                targetFile.write(data)
                console.log('[occupancy csv_stringify] resolve')
                return resolve()
            })
        })
    })
}

// Combine grouped detections report and send the email
async function processGroupedDetectionsStream (results, rowData, projection_parameters, allData, currentTime, message, jobName) {
    return new Promise(async function (resolve, reject) {
        let gKey = projection_parameters.grouped;

        let fields = [];
        results.forEach(result => {
            fields.push(...Object.keys(result).filter(f => f !== gKey && !fields.includes(f)))
        });

        let data = {};
        results.forEach((r, i) => {
            const s = r[gKey]
            // Create empty row for each grouped key.
            if (!data[s]) {
                data[s] = {};
                data[s][gKey] = s;
            };
            fields.forEach((f) => {
                // Fill for each cell 0 as default value.
                if (data[s][f] === undefined) { data[s][f] = 0 };
                data[s][f] += r[f] === '---' || r[f] === undefined ? 0 : +r[f];
            })
        });

        // Include all sites, data, hours without validations to the report.
        let extendedRows = allData.filter(i => !Object.keys(data).includes(i));
        extendedRows.forEach(s => {
            if (!data[s]) {
                data[s] = {};
                data[s][gKey] = s;
            };
            fields.forEach((f) => {
                if (data[s][f] === undefined) { data[s][f] = 'NA' };
            })
        })
        fields.unshift(gKey);

        let datastream = new stream.Readable({objectMode: true});
        let _buf = []

        datastream.on('data', (d) => {
            _buf.push(d)
        })
        let streamArray = Object.values(data);
        streamArray.sort(function(a, b) {
            if (gKey === 'date') {
                return new Date(a[gKey]) - new Date(b[gKey]);
            }
            else return a[gKey] - b[gKey];
        });
        for (let row of streamArray) {
            datastream.push(row);
        };
        datastream.push(null);

        datastream.on('end', async () => {
            csv_stringify(_buf, { header: true, columns: fields }, async (err, data) => {
                const content = Buffer.from(data).toString('base64')
                try {
                    await sendEmail('Arbimon Export Grouped detections report', 'grouped-detections-export.csv', rowData, content, false);
                    await updateExportRecordings(rowData, { processed_at: currentTime })
                    resolve()
                } catch(error) {
                    console.error('Error while sending grouped-detections-export email.', error)
                    await errorMessage(message, jobName)
                    await updateExportRecordings(rowData, { error: JSON.stringify(error) })
                    resolve()
                }
            })
        })
    })
}

// Send report to the user
// Thanks so much for using Arbimon! Your export report for the project “xxxx” has been completed. Please note that this link will expire in 7 days. If you have any questions about Arbimon, check out our support docs.
async function sendEmail (subject, title, rowData, content, isSignedUrl) {
    const textHeader = `<p style="color:black;margin-top:0">Hello,</p>
      <p style="color:black;">Thanks so much for using Arbimon! Your export report for the project "${rowData.name}" has been completed.`
    const textExpires = ` Please note that this link will expire in 7 days.`
    const textSupport = ` If you have any questions about Arbimon, check out our <a href="https://help.arbimon.org/">support docs</a>.
      </p>`
    const textFooter = `<p style="color:black;">
        <span> - The Arbimon Team </span>
      </p>`;

    const isGmail = rowData.user_email.includes('gmail.com');
    let message = {
        from_email: 'no-reply@arbimon.org',
        to: [{
            email: rowData.user_email
        }],
        subject: 'Arbimon export'
    }
    if (isSignedUrl) {
        if (isGmail) {
            return message.html = textHeader + textExpires + textSupport +
            `<button style="background:#ADFF2C;border:1px solid #ADFF2C;padding:6px 14px;;border-radius:9999px;cursor:pointer;margin: 10px 0">
                <a style="text-decoration:none;color:#14130D;white-space:nowrap;text-align:center;vertical-align:middle;align-items:center;display:inline-flex;display: -webkit-inline-flex;" download target="_self" href="${content}">
                    Download
                    <img style="width: 14px; height: 14px; margin-left:8px" src="https://static.rfcx.org/arbimon/download-icon.png">
                </a>
            </button>` + textFooter
        }
        else message.html = textHeader + textExpires + textSupport
            + `<img style="width: 14px; height: 14px; margin-left:8px" src="https://static.rfcx.org/arbimon/download-icon.png"><a style="margin-left: 1px" href="${content}">Download export</a>`
            + textFooter;
    } else {
        message.attachments = [{
            type: 'text/csv',
            name: title,
            content: content
        }]
        message.html = textHeader + textSupport + textFooter
    }
    return new Promise(function (resolve, reject) {
      const mandrillClient = new mandrill.Mandrill(process.env.MANDRILL_KEY)

      mandrillClient.messages
        .send({
          message,
          async: true
        },
        (res) => {
          console.log('email status', res)
          resolve({ success: true })
        },
        (e) => {
          console.error('Error send email.', e)
          reject(e)
        })
    })
}

main()
    .finally(() => {
        db.closeAll()
        process.exit(0)
    })
