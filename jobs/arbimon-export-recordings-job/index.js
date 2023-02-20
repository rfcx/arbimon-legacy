require('dotenv').config()
const db = require('../db')
const moment = require('moment')
const { getExportRecordingsRow } = require('../services/recordings')
const { reportStats } = require('../services/stats')
const recordings = require('../../app/model/recordings')
const stream = require('stream');
var csv_stringify = require("csv-stringify");

async function main () {
  try {
    console.log('arbimon-export-recordings job started')
  
    const dateByCondition = moment.utc().format('YYYY-MM-DD HH:mm:ss')
    const where = `created_at < '${dateByCondition} AND processed_at is null'`
    const limit = 1
    let toProcess = true
    let countOfProcessedRows = 0

    while (toProcess === true) {
        // Process recordings
        const result =  await getExportRecordingsRow({
            where,
            orderBy: 'created_at ASC',
            limit
        })
        toProcess = result.affectedRows > 0
        countOfProcessedRows += result.affectedRows

        const rowData = [result]
        let filters, projection_parameters

        try {
            filters = JSON.parse(rowData.filters)
            projection_parameters = JSON.parse(rowData.projection_parameters)
        } catch (e) {

        }

        const results = recordings.exportRecordingData(projection_parameters, filters)

        var datastream = results[0];
        var fields = results[1].map(function(f){return f.name;});
        const metaIndex = fields.indexOf('meta');
        if (metaIndex !== -1) {
            fields.splice(metaIndex, 1);
        }
        let colOrder={filename:-6,site:-5,time:-4, day:-4, month:-3, year:-2, hour:-1, date: 0};
        fields.sort(function(a, b){
            var ca = colOrder[a] || 0, cb = colOrder[b] || 0;
            return ca < cb ? -1 : (
                   ca > cb ?  1 : (
                    a <  b ? -1 : (
                    a >  b ?  1 :
                    0
            )));
        });

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
        datastream
            .pipe(csv_stringify({header:true, columns:fields}))
            // Send report to the user
            .pipe(res);
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

main()
