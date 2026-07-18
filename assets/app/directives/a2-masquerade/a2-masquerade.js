/**
 * Superuser masquerade tray (Phase 1, legacy app).
 *
 * A floating, collapsible tray on the RIGHT edge (matching the modern task-
 * tray stack), visible ONLY to real
 * superusers, mirroring the modern website's task-tray pattern. Lets a super
 * search for a user and start/stop "view as user". While masquerading the
 * top safety banner (header.ejs, framework-free) also shows an Exit.
 *
 * All authority lives server-side: this is a thin client over
 *   GET  /legacy-api/masquerade/status
 *   GET  /legacy-api/masquerade/search?q=
 *   POST /legacy-api/masquerade/start  { user_id }
 *   POST /legacy-api/masquerade/stop
 * The server gates every mutating call on the REAL JWT super identity, so the
 * tray cannot escalate; a non-super simply never sees it (and would be 403'd).
 */
angular.module('a2.directive.masquerade', [
    'a2.permissions'
])
.directive('a2Masquerade', function() {
    return {
        restrict: 'E',
        replace: true,
        templateUrl: '/directives/a2-masquerade/a2-masquerade.html',
        scope: {},
        controller: 'a2MasqueradeCtrl as masq'
    };
})
.controller('a2MasqueradeCtrl', function($scope, $http, $timeout, a2UserPermit) {
    var masq = this;

    // Real-super visibility. isSuper() reflects the CURRENT session.user, which
    // is the TARGET (non-super) while masquerading — so also treat an active
    // masquerade (masqueradedBy set) as "show", so the super can still Exit
    // from the tray even after the swap. On non-super sessions both are false.
    masq.visible = function() {
        return a2UserPermit.isSuper() || !!masq.status.active;
    };

    masq.collapsed = (function() {
        try { return sessionStorage.getItem('masq-tray-collapsed') === '1'; }
        catch (e) { return false; }
    })();
    masq.toggleCollapsed = function() {
        masq.collapsed = !masq.collapsed;
        try { sessionStorage.setItem('masq-tray-collapsed', masq.collapsed ? '1' : '0'); }
        catch (e) {}
    };

    masq.status = { active: false, target: null, expiresAt: null };
    masq.query = '';
    masq.results = [];
    masq.searching = false;
    masq.busy = false;
    masq.error = null;

    masq.refreshStatus = function() {
        $http.get('/legacy-api/masquerade/status').then(function(r) {
            masq.status = r.data || { active: false };
        }).catch(function() { /* leave prior status */ });
    };

    var searchTimer = null;
    masq.onQueryChange = function() {
        masq.error = null;
        if (searchTimer) $timeout.cancel(searchTimer);
        var q = (masq.query || '').trim();
        if (q.length < 2) { masq.results = []; masq.searching = false; return; }
        masq.searching = true;
        searchTimer = $timeout(function() {
            $http.get('/legacy-api/masquerade/search', { params: { q: q } }).then(function(r) {
                masq.results = r.data || [];
                masq.searching = false;
            }).catch(function(e) {
                masq.searching = false;
                masq.error = (e && e.data && e.data.error) || 'Search failed';
            });
        }, 300);
    };

    masq.start = function(user) {
        if (!user || !user.selectable || masq.busy) return;
        masq.busy = true; masq.error = null;
        $http.post('/legacy-api/masquerade/start', { user_id: user.id }).then(function(r) {
            masq.status = r.data;
            masq.busy = false;
            // Reload so every already-rendered controller re-fetches AS the target.
            window.location.reload();
        }).catch(function(e) {
            masq.busy = false;
            masq.error = (e && e.data && e.data.error) || 'Could not start';
        });
    };

    masq.stop = function() {
        if (masq.busy) return;
        masq.busy = true; masq.error = null;
        $http.post('/legacy-api/masquerade/stop', {}).then(function() {
            masq.busy = false;
            window.location.reload();
        }).catch(function(e) {
            masq.busy = false;
            masq.error = (e && e.data && e.data.error) || 'Could not stop';
        });
    };

    masq.refreshStatus();
});