const mysql = require('../db/mysql')
const config_hosts = require('../../config/hosts');

async function getProjectTemplate (options = {}) {
  const connection = await mysql.getConnection()
  const sql = `
    select t.name, sp.species_id, sp.scientific_name, st.songtype,
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

module.exports = {
  getProjectTemplate
}
