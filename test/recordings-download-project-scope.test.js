var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * REGRESSION GUARDS — /project/:url/recordings/(download|inline)/:id must not
 * serve a recording that belongs to a different project.
 *
 * Operator-requested 2026-09-25 (item #5 of the hidden-covers follow-ons).
 * Before the fix, downloadRecordingById looked the recording up by bare id
 * (model.recordings.findByIdAsync) -- the caller's access check covered the
 * project in the URL only, so any recording id was readable through any
 * project the caller could access. A missing id also crashed on
 * `recording.uri` -> 500.
 *
 * Measured on 7d of prod logs before fixing: 201 requests, 199 in-project
 * (200 OK), 2 cross-project (both 302, unauthenticated) -- no legitimate
 * cross-project caller exists.
 */
function read(p) { return fs.readFileSync(path.join(__dirname, '..', p), 'utf8'); }

describe('recordings download/inline — project scope', function() {

    it('model has a project-scoped findById that joins sites', function() {
        var src = read('app/model/recordings.js');
        var i = src.indexOf('findByIdInProject: function');
        expect(i).to.be.greaterThan(-1);
        var fn = src.slice(i, i + 1200);
        expect(fn).to.contain('JOIN sites s ON s.site_id = r.site_id');
        expect(fn).to.contain('r.recording_id = ? AND s.project_id = ?');
        expect(src.indexOf('findByIdInProjectAsync: function')).to.be.greaterThan(-1);
    });

    it('downloadRecordingById uses the scoped lookup and 404s on empty', function() {
        var src = read('app/routes/data-api/project/recordings.js');
        var i = src.indexOf('async function downloadRecordingById');
        expect(i).to.be.greaterThan(-1);
        var end = src.indexOf("router.get('/time-bounds'", i);
        var fn = src.slice(i, end);
        expect(fn).to.contain('findByIdInProjectAsync(recordingId, req.project.project_id)');
        expect(fn).to.not.contain('findByIdAsync(recordingId)');
        expect(fn).to.contain("res.status(404).json({ error: 'recording not found' })");
        // The 404 must come BEFORE any header/body work (no partial response).
        expect(fn.indexOf("res.status(404)")).to.be.lessThan(fn.indexOf('const applyHeaders'));
    });

    it('both /download/:id and /inline/:id go through downloadRecordingById', function() {
        var src = read('app/routes/data-api/project/recordings.js');
        expect(src).to.contain("router.get('/download/:recordingId', function(req, res, next) {\n    downloadRecordingById(req, res, false, next);");
        expect(src).to.contain("router.get('/inline/:recordingId', function(req, res, next) {\n    downloadRecordingById(req, res, true, next);");
    });
});