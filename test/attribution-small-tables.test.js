var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * SOURCE-SHAPE TEST: playlists / training_sets / project_classes record the
 * creating user (rfcx-local OPEN-ITEMS 375, user-attribution slice 2).
 *
 * Measured 2026-09-22: these three tables (49,654 / 7,123 / 70,537 rows) had NO
 * attribution column; the only trace of who created a playlist, training set or
 * project class was the write-only project_news log (22.7 % / ~100 % / fuzzy
 * coverage respectively). The columns are nullable and go-forward: history is
 * unrecoverable and deliberately not backfilled; an absent user is stored as
 * NULL, never 0 or a sentinel.
 *
 * Shape, not behaviour, is the property: every INSERT into these tables names
 * user_id, and every session-bearing route passes req.session.user.id. A
 * regression of the archived_by class (2026-09-09: the argument silently never
 * reached the model) passes a happy-path route test and fails this one.
 */

function src(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
var playlistsModel = src('app/model/playlists.js');
var soundscapesModel = src('app/model/soundscapes.js');
var trainingSetsModel = src('app/model/training_sets.js');
var projectsModel = src('app/model/projects.js');
var playlistsRoute = src('app/routes/data-api/project/playlists.js');
var trainingSetsRoute = src('app/routes/data-api/project/training_sets.js');
var soundscapesRoute = src('app/routes/data-api/project/soundscapes.js');
var projectRoute = src('app/routes/data-api/project/index.js');
var dbpoolPg = src('app/utils/dbpool-pg.js');

function inserts(s, table) {
  var re = new RegExp('INSERT INTO ' + table + '\\s*\\(([^)]*)\\)', 'g');
  var out = [], m;
  while ((m = re.exec(s)) !== null) out.push(m[1]);
  return out;
}

describe('attribution slice 2: every INSERT into the three tables names user_id', function() {
  it('playlists (model create + combine, soundscape region sample)', function() {
    var all = inserts(playlistsModel, 'playlists').concat(inserts(soundscapesModel, 'playlists'));
    expect(all.length, 'expected 3 playlist INSERT sites').to.equal(3);
    all.forEach(function(cols) { expect(cols).to.match(/\buser_id\b/); });
  });
  it('training_sets (model insert + combine)', function() {
    var all = inserts(trainingSetsModel, 'training_sets');
    expect(all.length, 'expected 2 training_sets INSERT sites').to.equal(2);
    all.forEach(function(cols) { expect(cols).to.match(/\buser_id\b/); });
  });
  it('project_classes (insertClass, insertBatchClassesAsync, insertClassAsync)', function() {
    var all = inserts(projectsModel, 'project_classes');
    expect(all.length, 'expected 3 project_classes INSERT sites').to.equal(3);
    all.forEach(function(cols) { expect(cols).to.match(/\buser_id\b/); });
  });
});

describe('attribution slice 2: the routes pass the session user', function() {
  it('playlist create + combine', function() {
    expect(playlistsRoute).to.match(/user_id: req\.session\.user\.id\s*\n\s*\};\s*\n\s*model\.playlists\.create\(opts\)/);
    expect(playlistsRoute).to.match(/model\.playlists\.combine\(\{[\s\S]{0,200}user_id: req\.session\.user\.id/);
  });
  it('training set create + combine', function() {
    expect(trainingSetsRoute).to.match(/model\.trainingSets\.insert\(\{\s*\n\s*project_id : req\.project\.project_id,\s*\n\s*user_id : req\.session\.user\.id/);
    expect(trainingSetsRoute).to.match(/projectId: req\.project\.project_id,\s*\n\s*user_id: req\.session\.user\.id/);
  });
  it('soundscape region sample playlist', function() {
    expect(soundscapesRoute).to.match(/sampleRegion\(req\.soundscape, req\.region, \{[\s\S]{0,120}user_id : req\.session\.user\.id/);
  });
  it('batch class add', function() {
    expect(projectRoute).to.match(/insertBatchClassesAsync\(req\.project\.project_id,\s*projectClasses,\s*req\.session\.user\.id\)/);
  });
  it('EVERY insertClass caller builds its projectClass with user_id (the demo proof caught this one)', function() {
    // Measured on demo 2026-09-22: class/add returned 200 and wrote user_id=NULL because the
    // route's projectClass literal never carried the session user -- the model's null guard
    // did exactly what it should and the attribution was silently absent. Assert per caller.
    var aedRoute = src('app/routes/data-api/project/audio-event-detections-clustering.js');
    var pmRoute = src('app/routes/data-api/project/pattern_matchings.js');
    [projectRoute, aedRoute, pmRoute].forEach(function(r, i) {
      var re = /projectClass = \{[\s\S]{0,260}?\};\s*\n\s*model\.projects\.insertClass\(/g;
      var m, n = 0;
      while ((m = re.exec(r)) !== null) { n++; expect(m[0], 'caller #' + i).to.match(/user_id: req\.session\.user\.id/); }
      expect(n, 'insertClass literal not found in route #' + i).to.be.above(0);
    });
  });
});

describe('attribution slice 2: NULL semantics and the translator map', function() {
  it('an absent user becomes NULL, never 0 (each model coerces with a null guard)', function() {
    expect(playlistsModel).to.match(/const actorId = \(v\) => \(v === undefined \|\| v === null\) \? null : Number\(v\)/);
    expect(trainingSetsModel).to.match(/=== undefined \|\| data\.user_id === null\) \? null : Number\(data\.user_id\)/);
    expect(projectsModel).to.match(/projectClass\.userId === null\) \? 'NULL' : Number\(projectClass\.userId\)/);
  });
  it('insertClass joi schema accepts (and does not require) user_id', function() {
    expect(projectsModel).to.match(/user_id: joi\.number\(\)\.allow\(null\)\.optional\(\)/);
  });
  it('NULLABLE_COLS carries the three new nullable columns (translator NULLS placement rule)', function() {
    ['playlists.user_id', 'training_sets.user_id', 'project_classes.user_id'].forEach(function(k) {
      expect(dbpoolPg, k).to.contain("'" + k + "': 1,");
    });
  });
});