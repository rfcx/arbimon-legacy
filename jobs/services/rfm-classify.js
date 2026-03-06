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
            SUBSTRING_INDEX(r.uri ,'/',-1 ) rec,
            cr.present "model presence",
            m.threshold "current threshold",
            cr.max_vector_value as "vector max value",
            s.name as "site",
            extract(year from r.datetime) year,
            extract(month from r.datetime) month,
            extract(day from r.datetime) day,
            extract(hour from r.datetime) hour,
            extract(minute from r.datetime) minute,
            r.meta,
            sp.scientific_name species,
            st.songtype
            FROM models m,
              job_params_classification jpc,
              species sp,
              classification_results cr,
              recordings r,
              sites s,
              songtypes st
            WHERE cr.job_id = ${options.jobId}
            AND jpc.job_id = cr.job_id
            AND jpc.model_id = m.model_id
            AND cr.recording_id = r.recording_id
            AND s.site_id = r.site_id
            AND sp.species_id = cr.species_id
            AND cr.songtype_id = st.songtype_id
            limit ${options.limit} offset ${options.offset};`

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
