const mysql = require('../db/mysql')

async function getSoundscapesForCSV (options = {}) {
  const connection = await mysql.getConnection()
  const sql = `
    select s.soundscape_id, s.name, concat(u.firstname, ' ', u.lastname, ' ', u.email) user, p.name playlist_name,
      s.bin_size bin_bandwidth, sat.identifier aggregation, s.threshold peak_filtering_amplitude, s.frequency peak_filtering_frequency
    from soundscapes s
      join users u on s.user_id = u.user_id
			join playlists p on s.playlist_id = p.playlist_id
			join soundscape_aggregation_types sat on s.soundscape_aggregation_type_id = sat.soundscape_aggregation_type_id
		where s.project_id = ${options.projectId}
      limit ${options.limit} offset ${options.offset}
    ;
  `
  const [rows, fields] = await connection.execute(sql)
  return rows
}

async function getProjectSoundscapes (options = {}) {
  const connection = await mysql.getConnection()
  const sql = `
    select s.soundscape_id id, s.name, s.project_id project, s.threshold, s.threshold_type, s.bin_size, s.normalized, s.uri,
      sat.identifier as aggregation, sat.name as aggr_name, sat.scale as aggr_scale
    from soundscapes s
      join soundscape_aggregation_types sat ON s.soundscape_aggregation_type_id = sat.soundscape_aggregation_type_id
    where s.project_id = ${options.projectId}
  ;`
  const [rows, fields] = await connection.execute(sql)
  return rows
}

module.exports = {
  getSoundscapesForCSV,
  getProjectSoundscapes
}
