const mysql = require('../db/mysql')

function parseMetaData(data) {
    try {
        const parsedData = JSON.parse(data);
        if (!parsedData) {
            return data;
        }
        return parsedData;
    } catch (e) {
        return null;
    }
}

async function getCsvData(options) {
    const connection = await mysql.getConnection()
    const sql = `SELECT
            SUBSTRING_INDEX(r.uri,'/',-1) rec,
            cr.present AS "model presence",
            m.threshold AS "current threshold",
            cr.max_vector_value AS "vector max value",
            s.name AS site,
            EXTRACT(YEAR FROM r.datetime) year,
            EXTRACT(MONTH FROM r.datetime) month,
            EXTRACT(DAY FROM r.datetime) day,
            EXTRACT(HOUR FROM r.datetime) hour,
            EXTRACT(MINUTE FROM r.datetime) minute,
            r.meta,
            sp.scientific_name species,
            st.songtype
          FROM (
            SELECT
              recording_id,
              species_id,
              songtype_id,
              present,
              max_vector_value,
              job_id
            FROM classification_results
            WHERE job_id = ${options.jobId}
            ORDER BY recording_id DESC
            LIMIT ${options.limit} OFFSET ${options.offset}
          ) cr
          JOIN recordings r ON cr.recording_id = r.recording_id
          JOIN sites s ON s.site_id = r.site_id
          JOIN species sp ON sp.species_id = cr.species_id
          JOIN songtypes st ON st.songtype_id = cr.songtype_id
          JOIN job_params_classification jpc ON jpc.job_id = cr.job_id
          JOIN models m ON m.model_id = jpc.model_id;`
    const [rows, fields] = await connection.execute(sql)
    if (!rows.length) return []
    for (let _1 of rows) {
        // Fill the original filename from the meta column.
        _1.meta = _1.meta ? parseMetaData(_1.meta) : null;
        _1.rec = _1.meta && _1.meta.filename? _1.meta.filename :  _1.rec;
    }
    return rows
}

async function getName(cid) {
    const connection = await mysql.getConnection()
    const sql = `SELECT REPLACE(lower(c.name),' ','_') as name, j.project_id as pid
            FROM job_params_classification c, jobs j
            WHERE c.job_id = j.job_id
            AND c.job_id = ${cid}`;

    const [rows, fields] = await connection.execute(sql)
    return rows
}

module.exports = {
    getCsvData,
    getName
}
