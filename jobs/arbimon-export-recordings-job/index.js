require('dotenv').config()
const db = require('../db')
const moment = require('moment')
const { getExportRecordingsRow, updateExportRecordings } = require('../services/recordings')
const { reportStats } = require('../services/stats')
const recordings = require('../../app/model/recordings')
const stream = require('stream');
const csv_stringify = require('csv-stringify');
const mandrill = require('mandrill-api/mandrill')

async function main () {
  try {
    console.log('arbimon-export-recordings job started')
  
    const dateByCondition = moment.utc().format('YYYY-MM-DD HH:mm:ss')
    const where = `created_at < '${dateByCondition} AND processed_at is null'`
    const limit = 1
    let toProcess = true
    let countOfProcessedRows = 0

    const mysqlConnection = await db.mysql.getConnection()
    while (toProcess === true) {
        await mysqlConnection.query('START TRANSACTION;')
        const result =  await getExportRecordingsRow({
            where,
            orderBy: 'created_at ASC',
            limit
        })
        toProcess = result.affectedRows > 0
        countOfProcessedRows += result.affectedRows
        const rowData = result[0]
        let filters, projection_parameters

        try {
            filters = JSON.parse(rowData.filters)
            projection_parameters = JSON.parse(rowData.projection_parameters)
        } catch (error) {
            await updateExportRecordings(rowData, { error })
            continue
        }
        const results = await recordings.exportRecordingData(projection_parameters, filters)
        await transformStream(results)
        await mysqlConnection.query('COMMIT;')
        continue
    }
    await db.closeAll()

    // Send report to the slack biodiversity-dev
    // await reportStats(countOfProcessedRows)
    console.log('arbimon-export-recordings job finished')
  } catch (e) {
    console.error(e)
    await db.closeAll()
  }
}

async function transformStream (results) {
    // Process csv file header
    let datastream = results[0];
    let fields = results[1].map(function(f){return f.name;});
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
                await sendEmail({
                    from_email: 'stas@rfcx.org', // 'contact@rfcx.org',
                    to: [{
                        email: 'zhenya@rfcx.org' // rowData.user_email
                    }],
                    subject: "Export recordings report [RFCx Arbimon]",
                    attachments: [{
                        type: 'text/csv',
                        name: "export-recordings.csv",
                        content: content
                    }]
                })
                await updateExportRecordings(rowData, { processed_at: dateByCondition })
            } catch(error) {
                await updateExportRecordings(rowData, { error })
            }
        })
    })
}

function sendEmail (message) {
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
          reject(e)
        })
    })
}

main()
