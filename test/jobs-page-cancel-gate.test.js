var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

/**
 * JOBS PAGE — CANCEL vs HIDE PERMISSION SPLIT (2026-09-24, rfcx-local).
 *
 * A project Expert launched a pattern-matching job, could not find it, could
 * not cancel it, and launched it again (a 530k-step duplicate). The Cancel
 * button on /project/<p>/jobs was gated on 'manage project jobs' AND
 * 'export report' -- the 2024 #1566 rule "Prevent delete job for the
 * user/expert roles" ('export report' = Owner/Admin only). That rule predates
 * a REAL cancel (09-20, OPEN-ITEMS §357); until then the button only hid rows.
 *
 * Now: CANCEL of an unfinished job needs only 'manage project jobs' (exactly
 * what the server route gates on); HIDE keeps the Owner/Admin restriction.
 *
 * Behavioural: the REAL controller is loaded with stubbed deps and $scope.hide
 * is driven across role x row. Red-probed at authoring: the pre-change file
 * fails the Expert/User rows of this matrix.
 */

var FILE = path.join(__dirname, '..', 'assets/app/app/jobs/index.js');

function loadController() {
    var src = fs.readFileSync(FILE, 'utf8');
    var ctrl;
    var mod = {};
    ['service', 'directive', 'config', 'filter', 'factory', 'run'].forEach(function(k) {
        mod[k] = function() { return mod; };
    });
    mod.controller = function(name, fn) {
        if (name === 'StatusBarNavController') { ctrl = Array.isArray(fn) ? fn[fn.length - 1] : fn; }
        return mod;
    };
    /* jshint evil:true */
    new Function('angular', src)({ module: function() { return mod; } });
    return ctrl;
}

var ROLES = {
    Owner:  ['manage project jobs', 'export report'],
    Admin:  ['manage project jobs', 'export report'],
    Expert: ['manage project jobs'],
    User:   ['manage project jobs'],
    Guest:  []
};
var ROWS = [
    { job_id: 1, state: 'processing', percentage: 40 },
    { job_id: 2, state: 'waiting',    percentage: 0 },
    { job_id: 3, state: 'error',      percentage: 100 },
    { job_id: 4, state: 'canceled',   percentage: 100 },
    // part-way-stopped finished jobs (measured 09-24: 18 error + 2 canceled
    // <100% in 3 months) -- these are HIDEs, not cancels
    { job_id: 5, state: 'error',      percentage: 37 },
    { job_id: 6, state: 'canceled',   percentage: 6.5 },
    { job_id: 7, state: 'initializing', percentage: 0 }
];

function outcome(ctrl, role, row) {
    var perms = ROLES[role], calls = [], denied = false;
    var $scope = { $watch: function() {}, $on: function() {} };
    var deps = {
        $scope: $scope,
        $http: { get: function(u) { calls.push(u); return { success: function() { return this; }, error: function() { return this; } }; } },
        $modal: { open: function() { return { opened: { then: function() {} }, result: { then: function(cb) { cb(true); } } }; } },
        $window: { location: {} },
        Project: { getUrl: function() { return 'p'; }, getInfo: function() {} },
        JobsData: { getJobTypes: function() { return { success: function() {} }; }, getJobs: function() { return []; },
                    updateJobs: function() {}, startTimer: function() {}, cancelTimer: function() {} },
        notify: { error: function() { denied = true; }, log: function() {}, serverError: function() {} },
        a2UserPermit: { can: function(p) { return perms.indexOf(p) !== -1; } }
    };
    var names = ctrl.toString().match(/function\s*\(([^)]*)\)/)[1].split(',').map(function(s) { return s.trim(); });
    ctrl.apply(null, names.map(function(n) { return deps[n]; }));
    $scope.hide(JSON.parse(JSON.stringify(row)));
    if (denied) { return 'deny'; }
    if (calls.some(function(u) { return u.indexOf('/jobs/cancel/') !== -1; })) { return 'cancel'; }
    if (calls.some(function(u) { return u.indexOf('/jobs/hide/') !== -1; })) { return 'hide'; }
    return 'none';
}

describe('jobs page: cancel vs hide permission split', function() {
    var ctrl = loadController();
    var EXPECT = {
        //       running   waiting   error100 cancel100 error37 cancel6 initializing
        Owner:  ['cancel', 'cancel', 'hide', 'hide', 'hide', 'hide', 'cancel'],
        Admin:  ['cancel', 'cancel', 'hide', 'hide', 'hide', 'hide', 'cancel'],
        Expert: ['cancel', 'cancel', 'deny', 'deny', 'deny', 'deny', 'cancel'],
        User:   ['cancel', 'cancel', 'deny', 'deny', 'deny', 'deny', 'cancel'],
        Guest:  ['deny',   'deny',   'deny', 'deny', 'deny', 'deny', 'deny']
    };
    Object.keys(EXPECT).forEach(function(role) {
        it(role + ': ' + ROWS.map(function(r) { return r.state + '@' + r.percentage; }).join(',') + ' -> ' + EXPECT[role].join('/'), function() {
            expect(ROWS.map(function(r) { return outcome(ctrl, role, r); })).to.deep.equal(EXPECT[role]);
        });
    });

    it('source shape: hide still requires export report; cancel gate is manage project jobs only', function() {
        var src = fs.readFileSync(FILE, 'utf8');
        expect(src).to.match(/!isCancel && !a2UserPermit\.can\('export report'\)/);
        expect(src).to.not.match(/can\('manage project jobs'\) && !a2UserPermit\.can\('export report'\)\)\)/);
        // the button label and the gate must use the same predicate
        var html = fs.readFileSync(path.join(__dirname, '..', 'assets/app/app/jobs/index.html'), 'utf8');
        expect(html).to.contain("isCancelable(row) ? 'Cancel' : 'Hide'");
    });
});