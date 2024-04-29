const mysql = require('../db/mysql')
const config_hosts = require('../../config/hosts');

async function getProjectTemplate (options = {}) {
  const connection = await mysql.getConnection()
  const sql = `
    select 'xyz.wav' saved_filename, t.template_id, t.species_id, sp.scientific_name, st.songtype,
      t.y1 freq_min_hz, t.y2 freq_max_hz, t.x2-t.x1 duration_secs,
      t.name template_name, concat(u.firstname, ' ', u.lastname, ' ', u.email) template_created_by,
      r.datetime recording_local_time, s.name site_name, s.lat site_latitude, s.lon site_longitude, p.name project_name
    from templates t
      left join species sp on t.species_id = sp.species_id
      left join songtypes st on t.songtype_id = st.songtype_id
      join recordings r on t.recording_id = r.recording_id
      join sites s on r.site_id = s.site_id
      join projects p on s.project_id = p.project_id
      join users u on t.user_id = u.user_id
    where t.project_id = ${options.projectId} and t.deleted = 0
      limit ${options.limit} offset ${options.offset}
    ;
  `
  const [rows, fields] = await connection.execute(sql)
  return rows
}

async function getTemplateDataForAudio (options = {}) {
  const connection = await mysql.getConnection()
  const sql = `
    SELECT T.template_id as id, T.project_id as project, T.recording_id as recording, T.species_id as species,
      T.songtype_id as songtype, T.name template_name, CONCAT('https://arbimon2.s3.us-east-1.amazonaws.com/', T.uri) as uri,
      T.x1, T.y1, T.x2, T.y2, T.date_created, T.user_id, T.disabled, R.uri as recUri, R.site_id as recSiteId,
      R.sample_rate, R.datetime, R.datetime_utc, S.external_id
    FROM templates T
      JOIN recordings R ON T.recording_id = R.recording_id
      JOIN sites S ON S.site_id = R.site_id
    WHERE T.template_id = ${options.templateId}
      ORDER BY date_created DESC
  `
  try {
    const [rows, fields] = await connection.execute(sql)
    return rows[0]
  } catch (err) {
    console.log('err get template', err)
  }
}

module.exports = {
  getProjectTemplate,
  getTemplateDataForAudio
}
