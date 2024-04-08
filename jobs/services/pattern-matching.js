const mysql = require('../db/mysql')
const config_hosts = require('../../config/hosts');

async function getPmRois (options = {}) {
  const connection = await mysql.getConnection()
  const sql = `
    select pm.pattern_matching_id job_id, pm.name job_name, sp.species_id, sp.scientific_name, st.songtype,
      s.site_id, s.name site_name, r.datetime recording_local_time, r.meta recording_meta, pmr.x1,
      pmr.y1, pmr.x2, pmr.y2, pmr.score, pmr.validated,
      CONCAT('${config_hosts.publicUrl}/legacy-api/project/${options.projectUrl}/recordings/download/', pmr.recording_id) as audio_url
    from pattern_matching_rois pmr
      join pattern_matchings pm on pm.pattern_matching_id = pmr.pattern_matching_id
      left join recordings r on pmr.recording_id = r.recording_id
      left join sites s on r.site_id = s.site_id
      left join templates t on r.recording_id = t.recording_id
      left join species sp on pmr.species_id = sp.species_id
      left join songtypes st on pmr.songtype_id = st.songtype_id
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
