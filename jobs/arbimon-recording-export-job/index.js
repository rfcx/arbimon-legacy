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
const { saveLatestData, combineFilename, uploadAsStream, getSignedUrl } = require('../services/storage')
const recordingsExport = require('./recordings')
const { streamToBuffer, zipDirectory } = require('../services/file-helper')

const S3_BUCKET_ARBIMON = process.env.S3_BUCKET_ARBIMON
const tmpFilePath = 'jobs/arbimon-recording-export-job/tmpfilecache'

async function main () {
  try {
    console.log('arbimon-recordings-export job started')

    const countConnections = await getCountConnections()
    if (countConnections > 10) {
        console.log('arbiton-export-recordings job stopped due to high db connections count')
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
        console.log('arbimon-recording-export has not any new export report')
        return
    }

    console.log(`\n\n project = ${ rowData.name }`)

    const message = `project = ${ rowData.name } [${ rowData.project_id }] ${ rowData.created_at }`
    const jobName = 'Export Recording Job'
    try {
        filters = JSON.parse(rowData.filters)
        projection_parameters = JSON.parse(rowData.projection_parameters)
    } catch (error) {
        console.error('Error parse params', error)
        await updateExportRecordings(rowData, { error: JSON.stringify(error) })
        await errorMessage(message, jobName)
        return
    }

    // Process the Clustering report
    if (projection_parameters && projection_parameters.aed) {
        let params = projection_parameters
        params.project_id = filters.project_id
        params.exportReport = true
        const data = await clusterings.findRois(params)
        return processClusteringStream(params.cluster, data, rowData, currentTime, message, jobName, projection_parameters.projectUrl).then(async () => {
            console.log(`arbimon-recording-export job finished: clustering report for ${message}`)
        })
    } else if (projection_parameters && projection_parameters.grouped && projection_parameters.validation) {
        // Combine grouped detections report
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
            console.log(`arbimon-recording-export job finished: grouped detections report for ${message}`)
        })
    } else if (projection_parameters && projection_parameters.species) {
        // Create the Occupancy model csv files, put them to .zip folder a send the folder to the user email
        await getMultipleOccupancyModelsData(projection_parameters, filters, rowData, currentTime, message, jobName)
    } else {
        // Recordings export
        return new Promise((resolve, reject) => {
            recordingsExport.collectData(projection_parameters, filters, async (err, filePath) => {
                if (err) {
                    console.error('arbimon-recording-export job error', err)
                    fs.unlink(filePath, () => {})
                    reject(err)
                }
                console.log('arbimon-recording-export job: uploading file to S3')
                const url = await saveFile(filePath, currentTime, rowData.project_id)
                console.log('arbimon-recording-export job: file is accessible by url', url)
                await sendEmail('Export recording report [RFCx Arbimon]', 'export-recording.csv', rowData, url, true)
                await updateExportRecordings(rowData, { processed_at: currentTime })
                await recordings.closeConnection()
                fs.unlink(filePath, () => {})
                console.log(`arbimon-recording-export job finished: export recordings report for ${message}`)
                resolve()
            })
        })
    }
  } catch (e) {
    console.error(e)
  }
}

async function saveFile (filePath, currentTime, projectId) {
    const s3FileKey = combineFilename(currentTime, projectId, 'export-recording', '.csv')
    await uploadAsStream({ filePath, Bucket: S3_BUCKET_ARBIMON, Key: s3FileKey, ContentType: 'text/csv' })
    return await getSignedUrl({ Bucket: S3_BUCKET_ARBIMON, Key: s3FileKey })
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
                    const filePath = await saveLatestData(S3_BUCKET_ARBIMON, data, rowData.project_id, currentTime, 'clustering-rois-export', '.csv', 'text/csv')
                    const url = await getSignedUrl({ Bucket: S3_BUCKET_ARBIMON, Key: filePath })
                    await sendEmail('Arbimon export completed', null, rowData, url, true)
                }
                try {
                    if (!isBigContent) {
                        await sendEmail('Arbimon export completed', 'clustering-rois-export.csv', rowData, content, false)
                    }
                    await updateExportRecordings(rowData, { processed_at: currentTime })
                    await recordings.closeConnection()
                    resolve()
                } catch(error) {
                    console.error('Error while sending clustering-rois-export email', error)
                    await errorMessage(message, jobName)
                    await updateExportRecordings(rowData, { error: JSON.stringify(error) })
                    await recordings.closeConnection()
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
    console.log('folder jobs/arbimon-recording-export-job/tmpfilecache exists', fs.existsSync(tmpFilePath))
    for (const [i, specie] of projection_parameters.species.entries()) {
        const data = await exportOccupancyModels(specie, filters)
        rowData.species_name = filters.species_name[i] || specie
        await processOccupancyModelStream(data, rowData, specie, filters).then(async () => {
            console.log(`occupancy models report for ${message}, specie ${rowData.species_name}`)
        })
    }
    await buildOccupancyFolder()
    await sendFolderToTheUser(rowData, currentTime, jobName, message)
}

async function buildOccupancyFolder() {
    await zipDirectory('jobs/arbimon-recording-export-job/tmpfilecache', 'jobs/arbimon-recording-export-job/tmpfilecache/occupancy-export.zip')
}

async function sendFolderToTheUser(rowData, currentTime, jobName, message) {
    await streamToBuffer().then(async (buffer) => {
        try {
            const filePath = await saveLatestData(S3_BUCKET_ARBIMON, buffer, rowData.project_id, currentTime, 'occupancy-export', '.zip', 'application/zip')
            const url = await getSignedUrl({ Bucket: S3_BUCKET_ARBIMON, Key: filePath })
            console.log('\n\n--------url-------', url)
            await sendEmail('Arbimon export completed', 'Occupancy export', rowData, url, true)
            await updateExportRecordings(rowData, { processed_at: currentTime })
            fs.rmSync(tmpFilePath, { recursive: true, force: true });
            await recordings.closeConnection()
        } catch(error) {
            console.error('Error while sending occupancy-model email.', error)
            await errorMessage(message, jobName)
            fs.rmSync(tmpFilePath, { recursive: true, force: true });
            await updateExportRecordings(rowData, { error: JSON.stringify(error) })
            await recordings.closeConnection()
        }
    })
}

async function processOccupancyModelStream (results, rowData, speciesId, filters) {
    return new Promise(async function (resolve, reject) {
        let sitesData = await getCountSitesRecPerDates(rowData.project_id, filters);
        let allSites = sitesData.map(item => { return item.site }).filter((v, i, s) => s.indexOf(v) === i);
        console.log('\n\n----allSites---', allSites)
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
        let datastream = new stream.Readable({objectMode: true});

        let _buf = []

        datastream.on('data', (d) => {
            _buf.push(d)
        })
        for (let row of Object.values(streamObject)) {
            datastream.push(row);
        }
        datastream.push(null);

        datastream.on('end', async () => {
            const title = 'occupancy-' + speciesId + '-' + rowData.species_name + '.csv';
            csv_stringify(_buf, { header: true, columns: fields }, async (err, data) => {
                fs.writeFile(`jobs/arbimon-recording-export-job/tmpfilecache/${title}`, data, function (err, result) {
                    if (err) {
                        console.log('error writing file to temp folder', err);
                        reject(err)
                    }
                });
                resolve()
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
                    await sendEmail('Arbimon export completed', 'grouped-detections-export.csv', rowData, content, false);
                    await updateExportRecordings(rowData, { processed_at: currentTime })
                    await recordings.closeConnection()
                    resolve()
                } catch(error) {
                    console.error('Error while sending grouped-detections-export email.', error)
                    await errorMessage(message, jobName)
                    await updateExportRecordings(rowData, { error: JSON.stringify(error) })
                    await recordings.closeConnection()
                    resolve()
                }
            })
        })
    })
}

// Send report to the user
async function sendEmail (subject, title, rowData, content, isSignedUrl) {
    const textHeader = `<p style="color:black;margin-top:0">Hello,</p>
      <p style="color:black;">Thanks so much for using Arbimon! Your export report for the project "${rowData.name}" has been completed.`
    const textExpires = ` Please note that this link will expire in 7 days.`
    const textSupport = ` If you have any questions about Arbimon, check out our <a href="https://support.rfcx.org/">support documentation</a> or
        reach out to us by clicking the <span style="color:green;font-size: 16px;">&#63;</span> icon, on the bottom right of any Arbimon page.
      </p>`
    const textFooter = `<p style="color:black;">
        <span> - The Arbimon Team </span>
      </p>`

    let message = {
        from_email: 'no-reply@arbimon.org',
        to: [{
            email: rowData.user_email
        }],
        subject: subject
    }
    if (isSignedUrl) {
        message.html = textHeader + textExpires + textSupport + `<button style="background:#31984f;border-color:#31984f;padding: 6px 12px;border-radius:4px;cursor:pointer;margin: 10px 0"> <a style="text-decoration:none;color:#e9e6e3" href="${content}">Download report</a> </button>` + textFooter
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
