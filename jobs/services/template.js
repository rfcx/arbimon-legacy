const mysql = require('../db/mysql')
const config_hosts = require('../../config/hosts');

async function getProjectTemplate (options = {}) {
  const connection = await mysql.getConnection()
  const sql = `
    select t.template_id, t.name, sp.species_id, sp.scientific_name, st.songtype,
      t.x1 minimum_time, t.x2 maximum_time,
      t.y1 minimum_frequency, t.y2 maximum_frequency,
      CONCAT('${config_hosts.publicUrl}/legacy-api/project/${options.projectUrl}/templates/download/', t.name, '/', t.template_id, '.wav') as template_url
    from templates t
      left join species sp on t.species_id = sp.species_id
      left join songtypes st on t.songtype_id = st.songtype_id
    where t.project_id = ${options.projectId} and t.deleted = 0 and t.source_project_id is null
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
      T.songtype_id as songtype, T.name, CONCAT('https://arbimon2.s3.us-east-1.amazonaws.com/', T.uri) as uri,
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
