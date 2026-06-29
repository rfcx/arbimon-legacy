/* jshint node:true */
"use strict";

const dbpool = require('../utils/dbpool');
const request = require('request');
const config = require('../config');
const debug = require('debug')('arbimon2:tiering');

// Tier reframe (2026-06-29): per-job recording (playlist size) cap. The limit
// itself is OWNED by bio-api (Bio Postgres `insights`.project_type_limit), which
// legacy can't read directly (different DB). bio-api exposes an unauthenticated
// entitlement endpoint keyed by project slug; we ask it for the project's
// `limits.jobRecordingCount` (null = uncapped) and enforce it at job-create
// time. Fail-OPEN on any bio-api error so a transient bio-api issue can't block
// production analysis.
const BIO_API_BASE_URL = (config('hosts').bioApi || '').replace(/\/$/, '');

function fetchProjectEntitlement(slug) {
    return new Promise(function (resolve) {
        if (!BIO_API_BASE_URL) { resolve(null); return; }
        request({
            method: 'GET',
            url: `${BIO_API_BASE_URL}/projects/${encodeURIComponent(slug)}/entitlement-summary`,
            json: true,
            timeout: 5000,
            // Force IPv4: Node's default dual-stack resolution tries AAAA first
            // for cluster-internal *.svc.cluster.local names and stalls ~5s
            // before falling back to A, which would race the timeout and
            // (fail-open) silently skip enforcement. family:4 => ~30ms.
            family: 4
        }, function (err, resp, body) {
            if (err || !resp || resp.statusCode !== 200 || !body) {
                debug('entitlement lookup failed (fail-open) for %s: %s', slug, err || (resp && resp.statusCode));
                resolve(null);
                return;
            }
            resolve(body);
        });
    });
}

async function getProjectSlugById(projectId) {
    const rows = await dbpool.query('SELECT url FROM projects WHERE project_id = ? LIMIT 1', [projectId]);
    return rows.length ? rows[0].url : null;
}

/**
 * Count the recordings in a playlist.
 */
async function getPlaylistRecordingCount(playlistId) {
    const rows = await dbpool.query(
        'SELECT COUNT(*) AS c FROM playlist_recordings WHERE playlist_id = ?', [playlistId]
    );
    return rows.length ? Number(rows[0].c || 0) : 0;
}

/**
 * Enforce the per-job recording (playlist size) cap for the given project.
 * Throws an Error (surfaced to the user) when the playlist exceeds the project's
 * jobRecordingCount limit. No-op when uncapped, when bio-api is unreachable
 * (fail-open), or when the project/playlist can't be resolved.
 *
 * @param {Integer} projectId
 * @param {Integer} playlistId
 */
async function getProjectSlugByPlaylistId(playlistId) {
    const rows = await dbpool.query(
        'SELECT p.url FROM playlists pl JOIN projects p ON p.project_id = pl.project_id WHERE pl.playlist_id = ? LIMIT 1',
        [playlistId]
    );
    return rows.length ? rows[0].url : null;
}

async function assertJobRecordingLimit(projectId, playlistId) {
    if (playlistId === undefined || playlistId === null) return;
    const slug = projectId
        ? await getProjectSlugById(projectId)
        : await getProjectSlugByPlaylistId(playlistId);
    if (!slug) return;
    const entitlement = await fetchProjectEntitlement(slug);
    const limit = entitlement && entitlement.limits ? entitlement.limits.jobRecordingCount : null;
    if (limit === null || limit === undefined) return; // uncapped
    const count = await getPlaylistRecordingCount(playlistId);
    if (count > Number(limit)) {
        const err = new Error(
            `This analysis would run on ${count.toLocaleString()} recordings, but ${entitlement.projectType || 'free'} projects are limited to ${Number(limit).toLocaleString()} recordings per analysis. Upgrade to Pro for unlimited recordings per analysis, or run on a smaller playlist.`
        );
        err.status = 403;
        err.http_code = 403;
        throw err;
    }
}

async function loadProjectTieringUsage(connection, projectId) {
    const usageRows = await dbpool.queryWithConn(connection,
        'SELECT \n' +
        '    COALESCE((\n' +
        '        SELECT COUNT(*)\n' +
        '        FROM recordings r\n' +
        '        JOIN sites s ON s.site_id = r.site_id\n' +
        // Archiving (Phase A): archived recordings do NOT count against tier
        // usage/quota (consistent with "looks deleted to the user"). This is a
        // billing-relevant decision -- see the design doc open-items.
        '        WHERE s.project_id = p.project_id AND s.deleted_at IS NULL AND r.archived_at IS NULL\n' +
        '    ), 0) AS recording_minutes_count,\n' +
        '    COALESCE((\n' +
        '        SELECT COUNT(*)\n' +
        '        FROM user_project_role upr\n' +
        '        WHERE upr.project_id = p.project_id AND upr.role_id = 3\n' +
        '    ), 0) AS guest_count,\n' +
        '    COALESCE((\n' +
        '        SELECT COUNT(*)\n' +
        '        FROM user_project_role upr\n' +
        '        WHERE upr.project_id = p.project_id AND upr.role_id NOT IN (3, 4)\n' +
        '    ), 0) AS collaborator_count\n' +
        'FROM projects p\n' +
        'WHERE p.project_id = ?',
        [projectId]
    );

    const jobRows = await dbpool.queryWithConn(connection,
        'SELECT \n' +
        '    COALESCE((SELECT COUNT(*) FROM pattern_matchings pm JOIN jobs j ON pm.job_id = j.job_id WHERE j.project_id = ? AND pm.deleted = 0), 0) AS pattern_matching_count,\n' +
        '    COALESCE((SELECT COUNT(*) FROM jobs j WHERE j.project_id = ? AND j.job_type_id IN (6) AND j.hidden = 0), 0) AS job_count', // check only pm for now
        [projectId, projectId]
    );

    const usage = usageRows[0] || {};
    const jobs = jobRows[0] || {};

    return {
        recordingMinutesCount: Number(usage.recording_minutes_count || 0),
        collaboratorCount: Number(usage.collaborator_count || 0),
        guestCount: Number(usage.guest_count || 0),
        patternMatchingCount: Number(jobs.pattern_matching_count || 0),
        jobCount: Number(jobs.job_count || 0)
    };
}

module.exports = {
    getProjectTieringUsage: async function(projectId) {
        const connection = await dbpool.getConnection();
        try {
            return await loadProjectTieringUsage(connection, projectId);
        } finally {
            connection.release();
        }
    },
    assertJobRecordingLimit,
    getPlaylistRecordingCount
};
