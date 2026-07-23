// Dev harness: print the P6-translated PG SQL for every export-path query in
// jobs/services/*, with representative params, for EXPLAIN validation against
// the live PG replica. Read-only; not shipped in the image CMD.
process.env.DB_ENGINE = 'mysql' // keep dbpool-pg INERT; we only use translate()
const t = require('../../app/utils/dbpool-pg')

const Q = {
  // services/recordings.js
  getExportRecordingsRow: `SELECT rep.*, p.name FROM recordings_export_parameters rep
                 JOIN projects p ON p.project_id = rep.project_id
                 WHERE rep.created_at < '2026-07-23 10:00:00' AND rep.processed_at is null AND error is null
                 ORDER BY rep.created_at ASC
                 LIMIT 1`,
  exportOccupancyModels: `SELECT S.name as site, S.site_id as site_id, DATE_FORMAT(R.datetime, "%Y/%m/%d") as date, SUM(CASE WHEN (rv.present=1 OR rv.present_review>0 OR rv.present_aed>0) THEN 1 ELSE 0 END) as count
        FROM recordings R
        JOIN sites S ON S.site_id = R.site_id
        LEFT JOIN project_imported_sites AS pis ON S.site_id = pis.site_id AND pis.project_id = 1209
        LEFT JOIN recording_validations AS rv ON R.recording_id = rv.recording_id
        WHERE rv.species_id = 74
            AND (S.project_id = 1209 OR pis.project_id = 1209)
            AND (rv.present_review>0 OR rv.present_aed>0 OR rv.present is not null)
        GROUP BY S.name, S.site_id, DATE_FORMAT(R.datetime, "%Y/%m/%d") ORDER BY MIN(R.datetime) ASC`,
  getCountSitesRecPerDates: `SELECT S.name as site, S.site_id as site_id, YEAR(R.datetime) as year, MONTH(R.datetime) as month, DAY(R.datetime) as day,COUNT(*) as count
        FROM sites S
        LEFT JOIN recordings R ON S.site_id = R.site_id
        WHERE S.project_id = 1209
            AND S.deleted_at is null
        GROUP BY S.name, S.site_id, YEAR(R.datetime), MONTH(R.datetime), DAY(R.datetime);`,
  // services/pattern-matching.js
  getPmRois: `select /*+ MAX_EXECUTION_TIME(360000) */ TRUNCATE(pmr.x1, 3) x1, TRUNCATE(pmr.y1, 3) y1, TRUNCATE(pmr.x2, 3) x2, TRUNCATE(pmr.y2, 3) y2,
      TRUNCATE(pmr.score, 3) score, pmr.validated, pmr.denorm_site_id as site_id,
      pmr.recording_id, pmr.denorm_recording_datetime recording_local_time
    from pattern_matching_rois pmr
    where pmr.pattern_matching_id = 124193
      limit 5 offset 0
    ;`,
  getProjectPMJobs: `select pm.pattern_matching_id job_id, pm.name job_name, pm.template_id, sp.species_id, sp.scientific_name, st.songtype
    from pattern_matchings pm
      join jobs j ON pm.job_id = j.job_id
      join species sp on pm.species_id = sp.species_id
      join songtypes st on pm.songtype_id = st.songtype_id
    where pm.project_id = 1209 and pm.deleted = 0 and j.state = 'completed'`,
  getProjectSitesJobsSvc: `select * from sites where project_id = 1209;`,
  // services/soundscape.js
  getSoundscapesForCSV: `select s.soundscape_id, s.name, concat(u.firstname, ' ', u.lastname, ' ', u.email) user, p.name playlist_name,
      s.bin_size bin_bandwidth, sat.identifier aggregation, s.threshold peak_filtering_amplitude, s.frequency peak_filtering_frequency
    from soundscapes s
      join users u on s.user_id = u.user_id
			join playlists p on s.playlist_id = p.playlist_id
			join soundscape_aggregation_types sat on s.soundscape_aggregation_type_id = sat.soundscape_aggregation_type_id
		where s.project_id = 1209
      limit 5 offset 0
    ;`,
  getProjectSoundscapes: `select s.soundscape_id id, s.name, s.project_id project, s.threshold, s.threshold_type, s.bin_size, s.normalized, s.uri,
      sat.identifier as aggregation, sat.name as aggr_name, sat.scale as aggr_scale
    from soundscapes s
      join soundscape_aggregation_types sat ON s.soundscape_aggregation_type_id = sat.soundscape_aggregation_type_id
    where s.project_id = 1209
  ;`,
  // services/template.js
  getProjectTemplate: `select 'xyz.wav' saved_filename, t.template_id, t.species_id, sp.scientific_name, st.songtype,
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
    where t.project_id = 1209 and t.deleted = 0
      limit 5 offset 0
    ;`,
  getTemplateDataForAudio: `SELECT T.template_id as id, T.project_id as project, T.recording_id as recording, T.species_id as species,
      T.songtype_id as songtype, T.name template_name, CONCAT('https://arbimon.org/legacy-api', '/', T.uri) as uri,
      T.x1, T.y1, T.x2, T.y2, T.date_created, T.user_id, T.disabled, R.uri as rec_uri, R.site_id as rec_site_id,
      R.sample_rate, R.datetime, R.datetime_utc, S.external_id
    FROM templates T
      JOIN recordings R ON T.recording_id = R.recording_id
      JOIN sites S ON S.site_id = R.site_id
    WHERE T.template_id = 1
      ORDER BY date_created DESC`,
  // services/rfm-classify.js
  getCsvData: `SELECT
            SUBSTRING_INDEX(r.uri,'/',-1) rec,
            cr.present AS "model presence",
            m.threshold AS "current threshold",
            cr.max_vector_value AS "vector max value",
            s.name AS site,
            EXTRACT(YEAR FROM r.datetime) AS "year",
            EXTRACT(MONTH FROM r.datetime) AS "month",
            EXTRACT(DAY FROM r.datetime) AS "day",
            EXTRACT(HOUR FROM r.datetime) AS "hour",
            EXTRACT(MINUTE FROM r.datetime) AS "minute",
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
            WHERE job_id = 1
            ORDER BY recording_id DESC
            LIMIT 5 OFFSET 0
          ) cr
          JOIN recordings r ON cr.recording_id = r.recording_id
          JOIN sites s ON s.site_id = r.site_id
          JOIN species sp ON sp.species_id = cr.species_id
          JOIN songtypes st ON st.songtype_id = cr.songtype_id
          JOIN job_params_classification jpc ON jpc.job_id = cr.job_id
          JOIN models m ON m.model_id = jpc.model_id;`,
  getNameRfm: `SELECT REPLACE(lower(c.name),' ','_') as name, j.project_id as pid
            FROM job_params_classification c, jobs j
            WHERE c.job_id = j.job_id
            AND c.job_id = 1`,
  getJobMetaRfm: `SELECT c.job_id AS job_id, c.name AS job_name, pl.name AS playlist_name
            FROM job_params_classification c
            LEFT JOIN playlists pl ON pl.playlist_id = c.playlist_id
            WHERE c.job_id = 1`,
  getRecordingByIds: `select * from recordings where recording_id in (1,2,3)`,
  // app/model/projects.js (export job callers) — statically expressible:
  getProjectSites: `SELECT s.site_id as id, s.name, s.lat, s.lon, s.alt, s.timezone, s.published, s.updated_at, s.external_id, s.timezone_locked, s.hidden, s.project_id != 1209 AS imported, s.country_code
    FROM sites AS s
    LEFT JOIN project_imported_sites as pis ON s.site_id = pis.site_id AND pis.project_id = 1209
    WHERE (s.project_id = 1209 OR pis.project_id = 1209) AND s.deleted_at is null`,
  getProjectDates: `SELECT COALESCE(DATE_FORMAT(MIN(r.datetime), "%Y/%m/%d")) as date
    FROM recordings AS r
    JOIN sites as s ON s.site_id = r.site_id AND s.project_id = 1209 AND s.deleted_at is null
    LEFT JOIN project_imported_sites as pis ON s.site_id = pis.site_id AND pis.project_id = 1209
    WHERE (s.project_id = 1209 OR pis.project_id = 1209) AND r.archived_at IS NULL
    GROUP BY YEAR(r.datetime), MONTH(r.datetime), DAY(r.datetime) ORDER BY MIN(r.datetime) ASC`,
  // app/model/clustering-jobs.js findRois export mode (aed branch):
  findRois_export: `SELECT A.aed_id, A.time_min, A.time_max, A.frequency_min, A.frequency_max, A.recording_id,
    CONCAT('audio_events/production/detection/', A.job_id, '/png/', A.recording_id, '/', A.uri_param, '.png') as 'uri', A.validated,
    A.species_id, A.songtype_id, sgt.songtype, sp.scientific_name
    FROM audio_event_detections_clustering A
    LEFT JOIN species sp ON sp.species_id = A.species_id
    LEFT JOIN songtypes sgt ON sgt.songtype_id = A.songtype_id
    WHERE 1=1 AND A.aed_id IN (1,2,3)`
}

// NOTE: recordings.exportRecordingData + recordings.groupedDetections are
// assembled at runtime by SQLBuilder with dynamic projections/joins that depend
// on projection_parameters (validation/classification/tag/soundscapeComposition
// columns with escapeId('val<...>') aliases). They CANNOT be fully represented
// statically here and MUST be validated by the per-type forced-recipient E2E.

for (const [name, sql] of Object.entries(Q)) {
  const out = t.translate(sql)
  // one line per query, delimiter markers for the shell harness
  console.log('-- QUERY: ' + name)
  console.log(out.replace(/;\s*$/, ''))
  console.log('-- END')
}