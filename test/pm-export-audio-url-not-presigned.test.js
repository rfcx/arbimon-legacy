var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * REGRESSION GUARD: pattern-matching exports must NOT embed raw storage presigned URLs.
 *
 * Measured on live prod 2026-09-24 (rfcx-local
 * runbooks/FINDING-2026-09-24-export-audio-url-signature-not-enforced.md): the PM
 * export's `audio_url` / `url` columns were `https://s3.arbimon.org/<bucket>/<key>?
 * AWSAccessKeyId=..&Expires=..&Signature=..`, and our storage chain (s3-proxy ->
 * s3-reader) ignores the caller's signature. A tampered signature, Expires=1, and
 * a stripped query string all returned 200. Each link was a permanent,
 * anonymous link to private-project audio (48,040 of them in one export).
 *
 * Both PM export paths now emit the auth-gated app download route instead, via
 * one helper.
 */
const { recordingDownloadUrl } = require('../app/utils/recording-download-url');
const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('PM export audio links are app download routes, not storage presigned URLs', function () {
    it('builds the legacy download route for a recording', function () {
        expect(recordingDownloadUrl('https://arbimon.org', 'juan-fernandez-islands-birds', 123456))
            .to.equal('https://arbimon.org/legacy-api/project/juan-fernandez-islands-birds/recordings/download/123456');
    });

    it('tolerates a trailing slash, and defaults the host', function () {
        expect(recordingDownloadUrl('https://arbimon.org/', 'p', 1)).to.equal('https://arbimon.org/legacy-api/project/p/recordings/download/1');
        expect(recordingDownloadUrl(undefined, 'p', 1)).to.equal('https://arbimon.org/legacy-api/project/p/recordings/download/1');
    });

    it('returns null (caller writes a placeholder) when the project or recording is unknown', function () {
        expect(recordingDownloadUrl('https://arbimon.org', '', 1)).to.equal(null);
        expect(recordingDownloadUrl('https://arbimon.org', 'p', null)).to.equal(null);
        expect(recordingDownloadUrl('https://arbimon.org', 'p', undefined)).to.equal(null);
    });

    it('never produces a storage host or a signature query string', function () {
        const u = recordingDownloadUrl('https://arbimon.org', 'p', 42);
        expect(u).to.not.match(/s3\.|AWSAccessKeyId|Signature=|X-Amz-/);
    });

    it('queued PM zip export no longer presigns storage URLs', function () {
        const src = read('jobs/arbimon-recording-export-job/pattern-matching.js');
        expect(/getSignedUrl/.test(src), "job file still calls getSignedUrl").to.equal(false);
        expect(src).to.match(/recordingDownloadUrl\(config_hosts\.publicUrl, projectUrl, result\.recording_id\)/);
    });

    it('per-job PM CSV route no longer presigns storage URLs', function () {
        const src = read('app/routes/data-api/project/pattern_matchings.js');
        expect(/patternMatchings\.getSignedUrl/.test(src), "route still presigns").to.equal(false);
        expect(src).to.match(/recordingDownloadUrl\(publicUrl, projectUrl, recId\)/);
    });
});