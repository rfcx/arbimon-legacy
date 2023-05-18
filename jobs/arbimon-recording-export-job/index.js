require('dotenv').config()
const db = require('../db')
const moment = require('moment')
const { getExportRecordingsRow, updateExportRecordings, getCountConnections } = require('../services/recordings')
const { errorMessage } = require('../services/stats')
const recordings = require('../../app/model/recordings')
const clusterings = require('../../app/model/clustering-jobs')
const projects = require('../../app/model/projects')
const stream = require('stream');
const csv_stringify = require('csv-stringify');
const mandrill = require('mandrill-api/mandrill')
const config_hosts = require('../../config/hosts');
const { getSignedUrl, saveLatestData } = require('../services/storage')
const S3_BUCKET_ARBIMON = process.env.S3_BUCKET_ARBIMON

async function main () {
  try {
    console.log('arbimon-recordings-export job started')

    const countConnections = await getCountConnections()
    if (countConnections > 10) {
        console.log('arbiton-export-recordings job stopped due to high db connections count')
        return
    }

    let filters, projection_parameters
    const dateByCondition = moment.utc().format('YYYY-MM-DD HH:mm:ss')
    const limit = 1
    const [rowData] =  await getExportRecordingsRow({
        dateByCondition,
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

    if (projection_parameters && projection_parameters.aed) {
        // Process the Clustering report
        let params = projection_parameters
        params.project_id = filters.project_id
        params.exportReport = true
        const data = await clusterings.findRois(params)
        return processClusteringStream(params.cluster, data, rowData, dateByCondition, message, jobName, projection_parameters.projectUrl).then(async () => {
            console.log(`arbimon-recording-export job finished: clustering report for ${message}`)
        })
    }
    else if (projection_parameters && projection_parameters.species) {
        // Process the Occupancy model report
        const data = await recordings.exportOccupancyModels(projection_parameters, filters)
        return processOccupancyModelStream(data, rowData, dateByCondition, message, jobName).then(async () => {
            console.log(`arbimon-recording-export job finished: occupancy models report for ${message}`)
        })
    }
    else if (projection_parameters && projection_parameters.grouped && projection_parameters.validation && !projection_parameters.species) {
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
        return processGroupedDetectionsStream(data, rowData, projection_parameters, allData, dateByCondition, message, jobName).then(async () => {
            console.log(`arbimon-recording-export job finished: grouped detections report for ${message}`)
        })
    }

    const data = await recordings.exportRecordingData(projection_parameters, filters)
    return transformStream(data, rowData, dateByCondition, message, jobName, projection_parameters.projectUrl).then(async () => {
        console.log(`arbimon-recording-export job finished: export recordings report for ${message}`)
    })
  } catch (e) {
    console.error(e)
  }
}

// Process Clustering report and send the email
async function processClusteringStream (cluster, results, rowData, dateByCondition, message, jobName, projectUrl) {
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
                    d.uri = `${config_hosts.publicUrl}/api/project/${projectUrl}/recordings/download/${d.recording_id}`;
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
                    const filePath = await saveLatestData(S3_BUCKET_ARBIMON, data, rowData.project_id, dateByCondition, 'clustering-rois-export')
                    const url = await getSignedUrl(S3_BUCKET_ARBIMON, filePath, 'text/csv')
                    await sendEmail('Export Clustering ROIs report [RFCx Arbimon]', null, rowData, url, true)
                }
                try {
                    if (!isBigContent) {
                        await sendEmail('Export Clustering ROIs [RFCx Arbimon]', 'clustering-rois-export.csv', rowData, content, false)
                    }
                    await updateExportRecordings(rowData, { processed_at: dateByCondition })
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
async function processOccupancyModelStream (results, rowData, dateByCondition, message, jobName) {
    return new Promise(async function (resolve, reject) {
        let sitesData = await recordings.getCountSitesRecPerDates(rowData.project_id);
        let allSites = sitesData.map(item => { return item.site }).filter((v, i, s) => s.indexOf(v) === i);
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
                streamObject[row.site][index+1] = row.count === 0 ? 0 : 1;
                streamObject[row.site][fields.length+index+1] = (new Date(row.date).getTime()/86400000 + 2440587.5).toFixed();
            }
            else {
                let tempRow = {};
                let tempJdays = {};
                // Fill each cell in the report.
                fields.forEach((item) => {
                    tempRow.site = row.site;
                    let site = sitesData.find(site => {
                        if (site.site === row.site) {
                            return item === moment(new Date(`${site.year}/${site.month}/${site.day}`)).format('YYYY/MM/DD');
                        }
                    });
                    // Occupancy parameter:
                    // 1 (present); 0 (absent);
                    // NA ( device was not active in that day, in other words, there are no recordings for this day);
                    // NI ( no information from the user if species is present or absent). Changed to 0
                    tempRow[item] = item === row.date? (row.count === 0 ? 0 : 1) : (site ? '0' : 'NA');
                    // Detection parameter:
                    // The julian day when there are recordings for that day;
                    // NA if the recorder was not active in that day (i.e there is no recordings associated with that day).
                    tempJdays[item] = item === row.date? (new Date(row.date).getTime()/86400000 + 2440587.5).toFixed() : (site ? (new Date(item).getTime()/86400000 + 2440587.5).toFixed() : 'NA');
                });
                streamObject[row.site] = [...Object.values(tempRow), ...Object.values(tempJdays)];
            }
        };
        // Get sites without validations.
        let notValidated = allSites.filter(site => !results.find(res => site === res.site ));
        if (notValidated && notValidated.length) {
            for (let row of notValidated) {
                let notValidatedRow = {};
                let notValidatedDays = {};
                fields.forEach((item) => {
                    notValidatedRow.site = row;
                    let site = sitesData.find(site => {
                        if (site.site === row) {
                            return item === moment(new Date(`${site.year}/${site.month}/${site.day}`)).format('YYYY/MM/DD');
                        }
                    });
                    notValidatedRow[item] = site ? '0' : 'NA';
                    notValidatedDays[item] = site ? (moment(new Date(`${site.year}/${site.month}/${site.day}`)).valueOf()/86400000 + 2440587.5).toFixed() : 'NA';
                });
                streamObject[row] = [...Object.values(notValidatedRow), ...Object.values(notValidatedDays)];
            }
        }
        fields = [...fields, ...fields];
        fields.unshift('site');

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
            csv_stringify(_buf, { header: true, columns: fields }, async (err, data) => {
                const content = Buffer.from(data).toString('base64')
                try {
                    await sendEmail('Export occypancy model report [RFCx Arbimon]', 'occupancy-model.csv', rowData, content, false)
                    await updateExportRecordings(rowData, { processed_at: dateByCondition })
                    await recordings.closeConnection()
                    resolve()
                } catch(error) {
                    console.error('Error while sending occupancy-model email.', error)
                    await errorMessage(message, jobName)
                    await updateExportRecordings(rowData, { error: JSON.stringify(error) })
                    await recordings.closeConnection()
                    resolve()
                }
            })
        })
    })
}

// Combine grouped detections report and send the email
async function processGroupedDetectionsStream (results, rowData, projection_parameters, allData, dateByCondition, message, jobName) {
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
                    await sendEmail('Export grouped detections [RFCx Arbimon]', 'grouped-detections-export.csv', rowData, content, false)
                    await updateExportRecordings(rowData, { processed_at: dateByCondition })
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

// Process the Export recordings report and send the email
async function transformStream (results, rowData, dateByCondition, message, jobName, projectUrl) {
    return new Promise(function (resolve, reject) {
        console.log('total results length', results.length)
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
                row.url = `${config_hosts.publicUrl}/api/project/${projectUrl}/recordings/download/${row.url}`;
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
            csv_stringify(_buf, { header: true, columns: fields }, async (err, data) => {
                const content = Buffer.from(data).toString('base64')
                const contentSize = Buffer.byteLength(content)
                const isBigContent = contentSize && contentSize > 10240 // 10MB
                if (isBigContent) {
                    const filePath = await saveLatestData(S3_BUCKET_ARBIMON, data, rowData.project_id, dateByCondition, 'export-recording')
                    const url = await getSignedUrl(S3_BUCKET_ARBIMON, filePath, 'text/csv')
                    await sendEmail('Export recording report [RFCx Arbimon]', null, rowData, url, true)
                }
                try {
                    if (!isBigContent) {
                        await sendEmail('Export recording report [RFCx Arbimon]', 'export-recording.csv', rowData, content, false)
                    }
                    await updateExportRecordings(rowData, { processed_at: dateByCondition })
                    await recordings.closeConnection()
                    resolve()
                } catch(error) {
                    console.error('Error while sending export-recording email.', error)
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
async function sendEmail (subject, title, rowData, content, isHtml) {
    let message = {
        from_email: 'no-reply@arbimon.org',
        to: [{
            email: rowData.user_email
        }],
        subject: subject
    }
    if (isHtml) {
        const htmlMessage = `<span style="color:black;">Your export report for the project "${rowData.name}" has been completed </span> <br>
          <button style="background:#31984f;border-color:#31984f;padding: 6px 12px;border-radius:4px;cursor:pointer;margin: 10px 0"> <a style="text-decoration:none;color:#e9e6e3" href="${content}">Download report</a> </button> <br>
          <span style="color:black;">Or copy the following link into your browser: ${content}</span>`
        message.html = htmlMessage
    } else {
        message.attachments = [{
            type: 'text/csv',
            name: title,
            content: content
        }]
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
