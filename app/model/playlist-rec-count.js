/**
 * Write-path maintenance of `playlists.total_recordings` (2026-09-22).
 *
 * WHAT THIS IS
 * ------------
 * `GET /project/:p/playlists` (the visualizer's "Browse Recordings by Playlist"
 * dropdown, the playlists page) used to attach each playlist's size with a
 * correlated `SELECT COUNT(*) FROM playlist_recordings ...` per row. Measured on
 * prod 2026-09-22 for puerto-rico-island-wide: 1,710 playlists × 25k rows avg
 * = 43.3 M index rows walked per request, 25.9 s cold / 3.7 s warm on the
 * replica, 2.1–3.7 s at the browser on EVERY visualizer load. The column
 * `playlists.total_recordings` already existed and was already written by the
 * create/combine/archive paths -- it was just never READ by the list route,
 * and two writers left it stale. This module closes those gaps so the read can
 * be a column fetch.
 *
 * THE CONTRACT (operator ruling 2026-09-22 10:52, same shape as sites.rec_count)
 * -----------------------------------------------------------------------------
 * "rec_count column, updated on playlist change (including changes to playlist
 * contents), plus a hygiene background job to ensure correctness." So:
 *   * every write path in this codebase that changes playlist_recordings calls
 *     into here INSIDE ITS OWN TRANSACTION (create/combine already set it from
 *     the insert; the three membership-removing/adding paths that did not --
 *     recordings.delete → removeArchivedFromPlaylists, sites.archiveRecordingsBySite,
 *     soundscapes.getRegionSample's playlist insert -- now do);
 *   * drift from writers this code cannot see (manual DML, the retired sync
 *     crons, a missed event) is owned by the rfcx-local `count-repair-plane`
 *     CronJob's playlist audit, NOT by a TTL here. Read the ruling before
 *     adding a self-heal.
 *
 * WHY ONE UPDATE ... = (subquery) AND NOT +n / -n
 * ----------------------------------------------
 * The membership DELETEs are keyed by recording_id, not playlist_id: one
 * archived day of one site can touch hundreds of playlists and the caller does
 * not know how many rows each lost. Recounting the affected playlists from
 * playlist_recordings (a pkey range scan per playlist, ~15 ms on a 25k-row
 * playlist, warm) is exact by construction and idempotent. It runs on the
 * transaction's connection after the DELETE so it sees the post-delete rows and
 * commits or rolls back with them. Bounded: only the playlists that contained
 * one of the ids, never the project's whole set.
 *
 * Dependency-injected (`execQuery`) so it is unit-testable and so this file
 * has NO require on ./playlists or ./recordings (both of which would be
 * circular from the callers that need this).
 */
'use strict';

function cleanIds(ids) {
    return (ids || []).map(Number).filter(function (n) { return Number.isInteger(n) && n > 0; });
}

/**
 * Playlists that currently contain any of `recIds`. Call BEFORE the DELETE.
 * @returns {Promise<number[]>}
 */
async function playlistsContaining(execQuery, recIds) {
    const ids = cleanIds(recIds);
    if (!ids.length) return [];
    const rows = await execQuery(
        'SELECT DISTINCT playlist_id FROM playlist_recordings WHERE recording_id IN (' + ids.join(',') + ')'
    );
    const list = Array.isArray(rows) ? (Array.isArray(rows[0]) ? rows[0] : rows) : [];
    return list.map(function (r) { return Number(r.playlist_id); }).filter(function (n) { return Number.isInteger(n) && n > 0; });
}

/**
 * Recount `total_recordings` for exactly `playlistIds`, from playlist_recordings,
 * in ONE statement on the caller's connection.
 */
function recount(execQuery, playlistIds) {
    const ids = cleanIds(playlistIds);
    if (!ids.length) return Promise.resolve();
    return execQuery(
        'UPDATE playlists SET total_recordings = (' +
        'SELECT COUNT(*) FROM playlist_recordings PLR WHERE PLR.playlist_id = playlists.playlist_id' +
        ') WHERE playlist_id IN (' + ids.join(',') + ')'
    );
}

/**
 * The membership-removal helper the archive paths use:
 *   const pls = await playlistRecCount.playlistsContaining(q, recIds)
 *   await q('DELETE FROM playlist_recordings WHERE recording_id IN (...)')
 *   await playlistRecCount.recount(q, pls)
 * Wrapped here so both callers do it in the same order.
 */
async function removeRecordingsAndRecount(execQuery, recIds) {
    const ids = cleanIds(recIds);
    if (!ids.length) return [];
    const pls = await playlistsContaining(execQuery, ids);
    await execQuery('DELETE FROM playlist_recordings WHERE recording_id IN (' + ids.join(',') + ')');
    await recount(execQuery, pls);
    return pls;
}

module.exports = {
    playlistsContaining: playlistsContaining,
    recount: recount,
    removeRecordingsAndRecount: removeRecordingsAndRecount,
    _cleanIds: cleanIds
};