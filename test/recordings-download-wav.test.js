var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * Visualizer Download → media-api WAV (operator 2026-09-25 09:22; ruling (a) 11:45).
 *
 *   - WAV from media-api, at the source sample rate / bit depth (mono: media-api
 *     writes -ac 1; stereo → mono accepted by the operator)
 *   - filename = the ORIGINAL upload name; a split upload's segment gets
 *     "<stem>.NNN.wav"
 */
var { recordingDownloadName, sanitizeStem } = require('../app/utils/recording-download-name');
function read(p) { return fs.readFileSync(path.join(__dirname, '..', p), 'utf8'); }

describe('recording download filename', function() {
    it('keeps the original upload name with a .wav extension', function() {
        expect(recordingDownloadName({ filename: '20210405_003000.flac', recording_id: 1 }, 1, 1)).to.equal('20210405_003000.wav');
        expect(recordingDownloadName({ filename: 'SMMINIBAT3_20251018_005534.wav', recording_id: 1 }, 1, 1)).to.equal('SMMINIBAT3_20251018_005534.wav');
        expect(recordingDownloadName({ filename: 'Core 2_S4A05603_20190411_012402.WAV', recording_id: 1 }, 1, 1)).to.equal('Core 2_S4A05603_20190411_012402.wav');
    });
    it('numbers the segments of a split upload, zero-padded to at least 3 digits', function() {
        expect(recordingDownloadName({ filename: '20260920_050000.WAV', recording_id: 1 }, 1, 300)).to.equal('20260920_050000.001.wav');
        expect(recordingDownloadName({ filename: '20260920_050000.WAV', recording_id: 1 }, 300, 300)).to.equal('20260920_050000.300.wav');
        expect(recordingDownloadName({ filename: 'x.wav', recording_id: 1 }, 7, 1200)).to.equal('x.0007.wav');
    });
    it('falls back to the recording id when there is no filename', function() {
        expect(recordingDownloadName({ filename: null, recording_id: 42 }, 1, 1)).to.equal('recording-42.wav');
        expect(recordingDownloadName({ filename: '   ', recording_id: 42 }, 1, 1)).to.equal('recording-42.wav');
    });
    it('legacy project_* rows (no filename) use the uploaded name from the storage key', function() {
        expect(recordingDownloadName({ filename: '', uri: 'project_38/site_211/2015/2/T34_20150225_190000.flac', recording_id: 126313 }, 1, 1)).to.equal('T34_20150225_190000.wav');
    });
    it('never uses a modern storage key (a UUID) as the name', function() {
        expect(recordingDownloadName({ filename: '', uri: '2021/04/05/aos2q1qflsbk/4599f1d4-9bf4-42e7-ae75-4ea823b3617e.flac', recording_id: 7 }, 1, 1)).to.equal('recording-7.wav');
    });
    it('never carries a path or a header-breaking character', function() {
        expect(sanitizeStem('../../etc/passwd.wav')).to.equal('passwd');
        expect(sanitizeStem('C:\\rec\\a.wav')).to.equal('a');
        expect(sanitizeStem('a"b;c\r\n.wav')).to.equal('a_b;c__');
    });
});

describe('recordings/download-wav route', function() {
    var src = read('app/routes/data-api/project/recordings.js');
    var i = src.indexOf("router.get('/download-wav/:recordingId'");
    var body = src.slice(i, src.indexOf("router.get('/download/:recordingId'", i));

    it('exists and is declared project-scoped by the checked model form', function() {
        expect(i).to.be.greaterThan(-1);
        var before = src.slice(Math.max(0, i - 200), i);
        expect(before).to.contain('// project-scope: model findByIdInProjectAsync');
        expect(body).to.contain('findByIdInProjectAsync(req.params.recordingId, req.project.project_id)');
        expect(body).to.contain("res.status(404).json({ error: 'recording not found' })");
    });
    it('mints a media-api WAV of the recording window and returns JSON, not bytes', function() {
        expect(body).to.contain("'rfull_g1_fwav.wav'");
        expect(body).to.contain('mediaAssetUrl(streamId, startMs, startMs + durMs');
        expect(body).to.contain('MEDIA_API_MAX_WINDOW_MS');
        expect(body).to.contain('res.json({ url: url, filename: filename');
        expect(body).to.not.match(/getRecordingFromS3|pipe\(res\)/);
    });
    it('numbers segments through the model (site_id + filename, datetime order)', function() {
        expect(body).to.contain('segmentPositionAsync(rec)');
        var m = read('app/model/recordings.js');
        var j = m.indexOf('segmentPositionAsync: function(rec)');
        expect(j).to.be.greaterThan(-1);
        var fn = m.slice(j, j + 1200);
        expect(fn).to.contain('WHERE r.site_id = ? AND r.filename = ?');
        expect(fn).to.contain('r.datetime < ? OR (r.datetime = ? AND r.recording_id <= ?)');
    });
    it('leaves the existing /download and /inline routes untouched', function() {
        expect(src).to.match(/router\.get\('\/download\/:recordingId', function\(req, res, next\) \{\n {4}downloadRecordingById\(req, res, false, next\);/);
        expect(src).to.match(/router\.get\('\/inline\/:recordingId', function\(req, res, next\) \{\n {4}downloadRecordingById\(req, res, true, next\);/);
    });
});