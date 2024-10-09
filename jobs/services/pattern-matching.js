const mysql = require('../db/mysql')

async function getPmRois (options = {}) {
  const connection = await mysql.getConnection()
  const sql = `
    select /*+ MAX_EXECUTION_TIME(360000) */ TRUNCATE(pmr.x1, 3) x1, TRUNCATE(pmr.y1, 3) y1, TRUNCATE(pmr.x2, 3) x2, TRUNCATE(pmr.y2, 3) y2,
      TRUNCATE(pmr.score, 3) score, pmr.validated, pmr.denorm_site_id as site_id,
      pmr.recording_id, pmr.denorm_recording_datetime recording_local_time
    from pattern_matching_rois pmr
    where pmr.pattern_matching_id = ${options.jobId}
      limit ${options.limit} offset ${options.offset}
    ;
  `
  const [rows, fields] = await connection.execute(sql)
  return rows
}

async function getProjectPMJobs (options = {}) {
  const connection = await mysql.getConnection()
  let sql = `
    select pm.pattern_matching_id job_id, pm.name job_name, pm.template_id, sp.species_id, sp.scientific_name, st.songtype
    from pattern_matchings pm
      join jobs j ON pm.job_id = j.job_id
      join species sp on pm.species_id = sp.species_id
      join songtypes st on pm.songtype_id = st.songtype_id
    where pm.project_id = ${options.projectId} and pm.deleted = 0 and j.state = 'completed'
  `
  if (options.jobs && options.jobs.length > 0) {
    sql += `and pm.pattern_matching_id in (${options.jobs})`
  }
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
