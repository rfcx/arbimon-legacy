var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * REGRESSION GUARDS — Site+Date paging for the SPA visualizer.
 *
 * rfcx-local FINDING 2026-10-21 (Wallauer visualizer report #2): the SPA sent
 * `?recording_id=` on EVERY list page, and `GET /recordings/:recUrl` answers a
 * `recording_id` query with the fixed 10-row neighbour window
 * (getPrevAndNextRecordingsAsync) -- limit/offset ignored -- so the day list
 * stalled at 20 tiles and refetched ~1/s (2,772 identical requests in one
 * 40-min session). The SPA now pages the day like a playlist and needs:
 *   1. GET /recordings/position/:recordingId -> { position, count } in the SAME
 *      order as the paged list (R.datetime, recording_id tiebreak), active
 *      rows only, project-scoped (404 for foreign/unknown ids).
 *   2. `segment: { index, count } | null` on each thumbnail-list row, from ONE
 *      grouped window query per page (not per row).
 */

function read(p) { return fs.readFileSync(path.join(__dirname, '..', p), 'utf8'); }
var model = read('app/model/recordings.js');
var route = read('app/routes/data-api/project/recordings.js');

function body(src, startMarker, endMarker) {
    var i = src.indexOf(startMarker);
    expect(i, startMarker).to.be.greaterThan(-1);
    var j = src.indexOf(endMarker, i + startMarker.length);
    expect(j, endMarker).to.be.greaterThan(i);
    return src.slice(i, j);
}

describe('recordings day position (Site+Date paging)', function() {

    it('dayPositionAsync orders by datetime then recording_id and scopes to active rows of ONE site-day', function() {
        var b = body(model, 'dayPositionAsync: function(rec)', 'annotateSegmentsAsync: function');
        expect(b).to.include('r.datetime < ? OR (r.datetime = ? AND r.recording_id < ?)');
        expect(b).to.include('r.site_id = ? AND r.datetime >= ? AND r.datetime < ?');
        expect(b).to.include("recordingArchiveScope('r', 'active')");
        expect(b).to.include('COUNT(*) AS count');
    });

    it('the paged day list orders by datetime (so position/page agree)', function() {
        var b = body(model, 'findByUrlMatch: function', 'return this.parseUrlQuery(recording_url)');
        expect(b).to.include('ORDER BY S.name ASC, R.datetime ASC');
    });

    it('route /position/:recordingId is project-scoped and 404s an unknown recording', function() {
        var b = body(route, "router.get('/position/:recordingId'", "router.get('/download-wav/:recordingId'");
        expect(b).to.include('findByIdInProjectAsync(req.params.recordingId, req.project.project_id)');
        expect(b).to.include("res.status(404)");
        expect(b).to.include('dayPositionAsync(rec)');
        // declared for build/check-project-scope.js
        var decl = route.slice(route.indexOf("router.get('/position/:recordingId'") - 60, route.indexOf("router.get('/position/:recordingId'"));
        expect(decl).to.include('// project-scope: model findByIdInProjectAsync');
    });

    it('route /position is declared BEFORE the catch-all /:recUrl? (express matches in order)', function() {
        expect(route.indexOf("router.get('/position/:recordingId'")).to.be.lessThan(route.indexOf("router.get('/:recUrl?'"));
    });
});

describe('recordings list segment annotation', function() {

    it('annotateSegmentsAsync is ONE window query per page, partitioned by (site_id, filename)', function() {
        var b = body(model, 'annotateSegmentsAsync: function(rows)', 'findByIdInProjectAsync: function');
        expect(b).to.include('ROW_NUMBER() OVER (PARTITION BY r.site_id, r.filename ORDER BY r.datetime, r.recording_id)');
        expect(b).to.include('COUNT(*) OVER (PARTITION BY r.site_id, r.filename)');
        expect(b).to.include('r.site_id IN (?) AND r.filename IN (?)');
        // single-segment files and rows without a filename report null, never (1/1)
        expect(b).to.include('s && s.count > 1 ? s : null');
    });

    it('the list projection carries R.site_id and R.filename, and the thumbnail-path shape is annotated', function() {
        var proj = body(model, 'projection = "R.recording_id AS id', 'let group_by, constraints');
        expect(proj).to.include('"R.site_id, \\n"');
        expect(proj).to.include('"R.filename, \\n"');
        var fbum = model.slice(model.indexOf('findByUrlMatch: function'));
        var compute = body(fbum, "return Recordings['__compute_' + property.replace(/-/g,'_')];", '} else {');
        expect(compute).to.include("indexOf('thumbnail-path') === -1) return rows");
        expect(compute).to.include('annotateSegmentsAsync(rows)');
    });
});