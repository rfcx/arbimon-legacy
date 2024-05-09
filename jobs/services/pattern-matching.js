const mysql = require('../db/mysql')

async function getPmRois (options = {}) {
  const connection = await mysql.getConnection()
  const sql = `
    select /*+ MAX_EXECUTION_TIME(360000) */  pm.pattern_matching_id job_id, pm.name job_name, pm.template_id, sp.species_id, sp.scientific_name, st.songtype,
    pmr.x1, pmr.y1, pmr.x2, pmr.y2, pmr.score, pmr.validated, pmr.denorm_site_id as site_id,
    pmr.recording_id, pmr.denorm_recording_datetime recording_local_time
    from pattern_matching_rois pmr
      join pattern_matchings pm on pm.pattern_matching_id = pmr.pattern_matching_id
      join species sp on pmr.species_id = sp.species_id
      join songtypes st on pmr.songtype_id = st.songtype_id
    where pm.project_id = ${options.projectId} and pm.pattern_matching_id = ${options.jobId} and pm.deleted = 0
      limit ${options.limit} offset ${options.offset}
    ;
  `
  const [rows, fields] = await connection.execute(sql)
  return rows
}

async function getProjectPMJobs (options = {}) {
  const connection = await mysql.getConnection()
  const sql = `
    select pm.pattern_matching_id jobId, pm.name jobName
    from pattern_matchings pm
    join jobs j ON pm.job_id = j.job_id
    where pm.project_id = ${options.projectId} and pm.deleted = 0 and j.state = 'completed'
    ;
  `
  const [rows, fields] = await connection.execute(sql)
  return rows
}

async function getProjectSites (options = {}) {
  const connection = await mysql.getConnection()
  const sql = `select * from sites where project_id = ${options.projectId};`
  const [rows, fields] = await connection.execute(sql)
  return rows
}

module.exports = {
  getPmRois,
  getProjectPMJobs,
  getProjectSites
}
