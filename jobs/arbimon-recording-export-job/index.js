require('dotenv').config()
const db = require('../db')
const moment = require('moment')
const { getExportRecordingsRow, updateExportRecordings, getCountConnections } = require('../services/recordings')
const { errorMessage } = require('../services/stats')
const recordings = require('../../app/model/recordings')
const projects = require('../../app/model/projects')
const stream = require('stream');
const csv_stringify = require('csv-stringify');
const mandrill = require('mandrill-api/mandrill')

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

    const message = `project = ${ rowData.name } [${ rowData.project_id }] ${ rowData.created_at }`
    try {
        filters = JSON.parse(rowData.filters)
        projection_parameters = JSON.parse(rowData.projection_parameters)
    } catch (error) {
        console.error('Error parse params', error)
        await updateExportRecordings(rowData, { error: JSON.stringify(error) })
        await errorMessage(message)
        return
    }

    // Process the Occupancy model report.
    if (projection_parameters && projection_parameters.species) {
        const data = await recordings.exportOccupancyModels(projection_parameters, filters)
        return processOccupancyModelStream(data, rowData, dateByCondition, message).then(async () => {
            console.log('arbimon-recording-export job finished: occupancy models report')
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
        return processGroupedDetectionsStream(data, rowData, projection_parameters, allData, dateByCondition, message).then(async () => {
            console.log('arbimon-recording-export job finished: grouped detections report')
        })
    }

    const data = await recordings.exportRecordingData(projection_parameters, filters)
    return transformStream(data, rowData, dateByCondition, message).then(async () => {
        console.log('arbimon-recording-export job finished: export recordings report')
    })
  } catch (e) {
    console.error(e)
  }
}

// Process the Occupancy model report and send the email
async function processOccupancyModelStream (results, rowData, dateByCondition, message) {
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
                    await sendEmail('Export occypancy model report [RFCx Arbimon]', 'occupancy-model.csv', rowData, content)
                    await updateExportRecordings(rowData, { processed_at: dateByCondition })
                    await recordings.closeConnection()
                    resolve()
                } catch(error) {
                    console.error('Error while sending occupancy-model email.', error)
                    await errorMessage(message)
                    await updateExportRecordings(rowData, { error: JSON.stringify(error) })
                    await recordings.closeConnection()
                    resolve()
                }
            })
        })
    })
}

// Combine grouped detections report and send the email
async function processGroupedDetectionsStream (results, rowData, projection_parameters, allData, dateByCondition, message) {
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
                    await sendEmail('Export grouped detections [RFCx Arbimon]', 'grouped-detections-export.csv', rowData, content)
                    await updateExportRecordings(rowData, { processed_at: dateByCondition })
                    await recordings.closeConnection()
                    resolve()
                } catch(error) {
                    console.error('Error while sending grouped-detections-export email.', error)
                    await errorMessage(message)
                    await updateExportRecordings(rowData, { error: JSON.stringify(error) })
                    await recordings.closeConnection()
                    resolve()
                }
            })
        })
    })
}

// Process the Export recordings report and send the email
async function transformStream (results, rowData, dateByCondition, message) {
    return new Promise(function (resolve, reject) {
        // Process csv file header
        let datastream = results[0];
        let fields = results[1].map(function(f) { return f.name })
        const metaIndex = fields.indexOf('meta');
        if (metaIndex !== -1) {
            fields.splice(metaIndex, 1);
        }
        let colOrder= { filename: -6,site: -5,time: -4, day: -4, month: -3, year: -2, hour: -1, date: 0 };
        fields.sort(function(a, b){
            const ca = colOrder[a] || 0, cb = colOrder[b] || 0;
            return ca < cb ? -1 : (
                ca > cb ?  1 : (
                    a <  b ? -1 : (
                    a >  b ?  1 :
                    0
            )));
        });

        let _buf = []

        datastream.on('data', (d) => {
            _buf.push(d)
        })

        datastream
            .pipe(new stream.Transform({
                objectMode: true,
                transform: function (row, encoding, callback) {
                    if (row.meta && row.filename) {
                        try {
                            const parsedMeta = JSON.parse(row.meta);
                            row.filename = parsedMeta && parsedMeta.filename? parsedMeta.filename :  row.filename;
                        } catch (e) {}
                        delete row.meta;
                    }
                    if (row.url) {
                        row.url = `${config('hosts').publicUrl}/api/project/${req.project.url}/recordings/download/${row.url}`;
                    }
                    // Fill a specific label for each cell without validations data.
                    fields.forEach(f => {
                        if (row[f] === undefined || row[f] === null) {
                            row[f] = '---'}
                        }
                    )
                    callback();
                }
            }))
        datastream.on('end', async () => {
            csv_stringify(_buf, { header: true, columns: fields }, async (err, data) => {
                const content = Buffer.from(data).toString('base64')
                try {
                    await sendEmail('Export recording report [RFCx Arbimon]', 'export-recording.csv', rowData, content)
                    await updateExportRecordings(rowData, { processed_at: dateByCondition })
                    await recordings.closeConnection()
                    resolve()
                } catch(error) {
                    console.error('Error while sending export-recording email.', error)
                    await errorMessage(message)
                    await updateExportRecordings(rowData, { error: JSON.stringify(error) })
                    await recordings.closeConnection()
                    resolve()
                }
            })
        })
    })
}

async function sendEmail (subject, title, rowData, content) {
    const message = {
        from_email: 'no-reply@rfcx.org',
        to: [{
            email: rowData.user_email
        }],
        subject: subject,
        attachments: [{
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
        () => {
          resolve({ success: true })
        },
        (e) => {
          console.error('Error send email.', e)
          reject(e)
        })
    })
}

main()
