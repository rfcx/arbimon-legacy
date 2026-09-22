var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * SOURCE-SHAPE TEST: recordings created through the ingest route record WHO
 * uploaded them (rfcx-local OPEN-ITEMS 375, user-attribution slice 3, legacy leg).
 *
 * Measured 2026-09-22: arbimon.recordings (~306.6M rows) had no uploader column
 * at all; the uploader is known at ingest (core ingest.stream_uploads.user_id,
 * 100% populated) and was thrown away at persistence -- and stream_uploads is
 * DROPped on a 14-day schedule, so the loss was permanent. Column added live
 * under a named operator GO (2026-09-22 11:30). The bridge identity is the
 * uploader's EMAIL (arbimon users.email is UNIQUE), forwarded by core-api;
 * resolved in ONE batched SELECT per request; unknown => NULL, never invented;
 * resolution failure never fails an ingest (fail-open by design).
 *
 * Shape asserted, not behaviour: both INSERT sites name uploaded_by, the schema
 * accepts it, the route resolves + plumbs it, the batch lookup exists, and the
 * translator's nullable map knows the column. Same rationale as
 * pm-validate-actor.test.js: the silent-NULL class passes a happy-path route test.
 */

function src(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
var recordings = src('app/model/recordings.js');
// recordings.js carries a `/*` INSIDE a line comment (the export-image note near
// writeExportParams), which the naive block-comment stripper above treats as an
// opener and swallows ~14 KB including the insert schema. Read the schema
// assertion from the RAW file (a joi chain cannot be faked by a comment).
var recordingsRaw = fs.readFileSync(path.join(__dirname, '..', 'app/model/recordings.js'), 'utf8');
var users = src('app/model/users.js');
var ingest = src('app/routes/data-api/ingest.js');
var dbpoolPg = src('app/utils/dbpool-pg.js');

describe('ingest attribution: recordings.uploaded_by (OPEN-ITEMS 375 slice 3, legacy leg)', function() {
  it('both INSERT INTO recordings sites name uploaded_by as the 17th column', function() {
    var re = /INSERT INTO recordings \(\\n' \+\s*\n\s*'`site_id`[^;]*?`meta`(, `uploaded_by`)?\\n' \+/g;
    var m, n = 0;
    while ((m = re.exec(recordings)) !== null) { n++; expect(m[1], 'INSERT site #' + n + ' lacks uploaded_by').to.equal(', `uploaded_by`'); }
    expect(n, 'expected 2 INSERT INTO recordings sites').to.equal(2);
  });
  it('the single-row INSERT binds 17 placeholders and the value comes from _uploadedBy', function() {
    expect(recordings).to.match(/VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?\);/);
    expect(recordings).to.match(/rec\.meta,\s*\n\s*Recordings\._uploadedBy\(rec\)\s*\n\s*\], \[rec\], callback\)/);
  });
  it('the batch INSERT row array ends with _uploadedBy(rec)', function() {
    expect(recordings).to.match(/rec\.datetime_utc, rec\.meta,\s*\n\s*Recordings\._uploadedBy\(rec\)\]/);
  });
  it('absent uploader is NULL, never 0', function() {
    expect(recordings).to.match(/_uploadedBy: function\(rec\) \{\s*\n\s*return \(rec\.uploaded_by === undefined \|\| rec\.uploaded_by === null\) \? null : Number\(rec\.uploaded_by\);/);
    expect(recordingsRaw).to.match(/uploaded_by:\s+joi\.number\(\)\.integer\(\)\.allow\(null\)\.optional\(\)/);
  });
  it('the ingest route accepts uploaded_by_email (optional), resolves in one batch, plumbs it, and fails open', function() {
    expect(ingest).to.match(/converter\.convert\('uploaded_by_email'\)\.toString\(\)\.optional\(\)/);
    expect(ingest).to.match(/const uploaderIds = await resolveUploaderIds\(converter\.transformedArray\)/);
    expect(ingest).to.match(/uploaded_by: data\.uploaded_by_email \? \(uploaderIds\[data\.uploaded_by_email\.toLowerCase\(\)\] \|\| null\) : null/);
    expect(ingest).to.match(/catch \(e\) \{[\s\S]{0,200}return \{\};/);
  });
  it('users.findByEmailsAsync is a bounded IN-list on LOWER(email)', function() {
    expect(users).to.match(/findByEmailsAsync: function\(emails\)/);
    expect(users).to.match(/SELECT user_id, email FROM users WHERE LOWER\(email\) IN \(\?\)/);
  });
  it('NULLABLE_COLS knows recordings.uploaded_by', function() {
    expect(dbpoolPg).to.contain("'recordings.uploaded_by': 1,");
  });
});