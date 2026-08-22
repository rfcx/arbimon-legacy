var expect = require('chai').expect;

// Pure-function guard for the date_range fast path. Deliberately requires the
// standalone util rather than app/model/recordings.js -- the model pulls in the
// whole DB connection stack, which cannot be loaded in a plain unit test.
var isEligible = require('../app/utils/date-range-fastpath').isDateRangeFastPathEligible;

var SCOPE = 'r.archived_at IS NULL';
var SITES = 'r.site_id IN (?)';

/**
 * REGRESSION GUARD.
 *
 * `date_range` on the recordings page used to run
 *   SELECT MIN(r.datetime), MAX(r.datetime) FROM recordings r
 *   WHERE r.archived_at IS NULL AND r.site_id IN (...)
 * which measured 154.5s on a 4M-recording project because no index covers
 * (site_id, archived_at, datetime). It is now answered with per-site index
 * dives on the existing (site_id, datetime) -- measured 0.004s.
 *
 * That rewrite is ONLY equivalent for the UNFILTERED project-wide question.
 * These tests pin the gate: if someone adds a filter and the gate keeps
 * returning true, the page would report a date range over the wrong row set.
 */
describe('recordings date_range fast path eligibility', function () {

  it('is eligible for the plain unfiltered project query', function () {
    expect(isEligible({
      tables: ['recordings AS r'],
      constraints: [SCOPE, SITES],
      archiveScope: SCOPE,
      explicitSites: undefined
    })).to.equal(true);
  });

  it('is eligible when the archive scope is empty (archived=all)', function () {
    expect(isEligible({
      tables: ['recordings AS r'],
      constraints: [SITES],
      archiveScope: '',
      explicitSites: undefined
    })).to.equal(true);
  });

  it('is NOT eligible when a date range filter is present', function () {
    expect(isEligible({
      tables: ['recordings AS r'],
      constraints: [SCOPE, SITES, 'r.datetime BETWEEN ? AND ? AND r.datetime IS NOT NULL'],
      archiveScope: SCOPE,
      explicitSites: undefined
    })).to.equal(false);
  });

  it('is NOT eligible when year/month/day/hour filters are present', function () {
    ['YEAR(r.datetime) IN (?)', 'MONTH(r.datetime) IN (?)',
     'DAY(r.datetime) IN (?)', 'HOUR(r.datetime) IN (?)'].forEach(function (extra) {
      expect(isEligible({
        tables: ['recordings AS r'],
        constraints: [SCOPE, SITES, extra],
        archiveScope: SCOPE,
        explicitSites: undefined
      }), extra).to.equal(false);
    });
  });

  it('is NOT eligible when an explicit site selection is made', function () {
    expect(isEligible({
      tables: ['recordings AS r', 'JOIN sites AS s ON s.site_id = r.site_id'],
      constraints: [SCOPE, 's.site_id IN (?)'],
      archiveScope: SCOPE,
      explicitSites: true
    })).to.equal(false);
  });

  it('is NOT eligible when any JOIN is added (validations/tags/playlists/etc)', function () {
    expect(isEligible({
      tables: [
        'recordings AS r',
        'LEFT JOIN recording_validations as rv ON r.recording_id = rv.recording_id'
      ],
      constraints: [SCOPE, SITES, 'pc.project_class_id IN (?)'],
      archiveScope: SCOPE,
      explicitSites: undefined
    })).to.equal(false);
  });

  it('is NOT eligible if constraints appear in an unexpected order', function () {
    // Defensive: the gate compares positionally, so a reordering upstream must
    // fail CLOSED (fall back to the correct-but-slow query) rather than open.
    expect(isEligible({
      tables: ['recordings AS r'],
      constraints: [SITES, SCOPE],
      archiveScope: SCOPE,
      explicitSites: undefined
    })).to.equal(false);
  });

  it('is NOT eligible when an unrecognised constraint replaces a known one', function () {
    expect(isEligible({
      tables: ['recordings AS r'],
      constraints: [SCOPE, 'RT.tag_id IN (?)'],
      archiveScope: SCOPE,
      explicitSites: undefined
    })).to.equal(false);
  });

  it('handles a missing/empty argument without throwing', function () {
    expect(isEligible()).to.equal(false);
    expect(isEligible({})).to.equal(false);
  });
});
