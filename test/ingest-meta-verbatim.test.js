var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * rfcx-local OPEN-ITEMS §438 (2026-09-29): the ingest route must store `meta` VERBATIM.
 * It used to backslash-escape apostrophes (`replace(/'/g, "\\'")`) before a PARAMETERISED insert,
 * which wrote invalid JSON (`\'`) -> recordings.filename (generated from meta) NULL and
 * __parse_meta_data -> null for every upload whose tags contained an apostrophe.
 * Behaviour, not just shape: extract the route's mapping of `data.meta` -> `metaData` and run it.
 */
describe('ingest: meta is stored verbatim (OPEN-ITEMS §438)', function() {
  var src = fs.readFileSync(path.join(__dirname, '..', 'app/routes/data-api/ingest.js'), 'utf8');
  // code only: the route's own comment documents the old escape, which must not count as a regression
  var code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  var line = (src.match(/^\s*const metaData = [^\n]*$/m) || [])[0];

  it('the route derives metaData from data.meta in one statement', function() {
    expect(line, 'const metaData = ... not found').to.be.a('string');
  });

  it('an apostrophe in a tag survives as valid JSON with its filename', function() {
    var data = { meta: JSON.stringify({ title: "Allard's Ground Cricket", artist: 'Lang Elliott', filename: '260706T1200-Allards-Ground-Cricket.wav' }) };
    var metaData = new Function('data', line.trim() + '\nreturn metaData;')(data);
    var parsed = JSON.parse(metaData); // throws on the old `\'` escape
    expect(parsed.title).to.equal("Allard's Ground Cricket");
    expect(parsed.filename).to.equal('260706T1200-Allards-Ground-Cricket.wav');
  });

  it('nothing in the route re-introduces a backslash-apostrophe escape', function() {
    expect(code).to.not.match(/replace\(\/'\/g,\s*"\\\\'"\)/);
  });
});
