const mysql = require('../db/mysql')
const config_hosts = require('../../config/hosts');

async function getPmRois (options = {}) {
  const connection = await mysql.getConnection()
  const sql = `
    select pm.pattern_matching_id job_id, pm.name job_name, pm.template_id, sp.species_id, sp.scientific_name, st.songtype,
    pmr.x1, pmr.y1, pmr.x2, pmr.y2, pmr.score, pmr.validated, s.site_id, s.name site_name,
    r.recording_id, r.datetime recording_local_time, r.uri audio_url
    from pattern_matching_rois pmr
      join pattern_matchings pm on pm.pattern_matching_id = pmr.pattern_matching_id
      join recordings r on pmr.recording_id = r.recording_id
      join sites s on r.site_id = s.site_id
      join species sp on pmr.species_id = sp.species_id
      join songtypes st on pmr.songtype_id = st.songtype_id
    where pm.project_id = ${options.projectId} and pm.deleted = 0
      limit ${options.limit} offset ${options.offset}
    ;
  `
  const [rows, fields] = await connection.execute(sql)
  return rows
}

module.exports = {
  getPmRois
}
