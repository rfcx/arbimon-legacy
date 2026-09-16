angular.module('a2.directive.side-bar', [])
.directive('a2SideBar', function(){
    return {
        restrict: 'E',
        templateUrl: '/directives/a2-side-bar/a2-side-bar.html',
        scope: {},
        replace: true,
        controller: 'a2SideBarCtrl as controller'
    };
})
.controller('a2SideBarCtrl', function($scope, $state, $timeout, Project, a2UserPermit) {

    $scope.showSidebar = false
    $scope.submenuEl = null
    $scope.mainmenuEl = null
  
    $scope.supportLink = 'http://help.arbimon.org/'

    $scope.isRfcx = function () {
        return a2UserPermit.isRfcx();
    }

    $scope.getUserEmail = function () {
        return a2UserPermit.getUserEmail()
    }

    $scope.getUserImage = function () {
        return a2UserPermit.getUserImage()
    }

    $scope.getUserFullName = function () {
        return a2UserPermit.getUserFullName()
    }

    $scope.initData = function() {
        Project.getInfo(function(info) {
            $scope.projectData = info;
            const url = info.url
            // NOTE: arbimonUrl is still read here because other call sites
            // use it, but the RAIL's own links are deliberately PATH-ONLY
            // below. On the demo tier bioAnalyticsBaseUrl is
            // https://arbimon.org (measured 2026-09-16), so host-qualified
            // rail links sent demo users into LIVE PRODUCTION mid-test.
            // Path-only links resolve against the current origin, so demo
            // stays on demo and prod stays on prod with no config at all.
            $scope.arbimonUrl = info.bioAnalyticsBaseUrl
            $scope.accountSettings = '/account-settings'
            $scope.allItems  = [
                {
                    title: 'Overview',
                    iconRaw: 'fi-grid',
                    public: true,
                    route: '/p/' + url + '/overview'
                },
                {
                    title: 'Import',
                    iconRaw: 'cloud-upload',
                    route: '/p/' + url + '/import-recordings'
                },
                {
                    // 'Browse data', NOT 'Explore' -- the SPA renamed this on
                    // 2026-08-28 because the rail's 'Explore' sat inches from
                    // the top-nav's 'Projects' link and the two go to
                    // completely different places (this browses the CURRENT
                    // project; that one is the public project directory).
                    title: 'Browse data',
                    iconRaw: 'fa-search',
                    children: [
                        {
                            // SPA VISUALIZER (rfcx-local, operator 2026-09-16).
                            // The modern rail points here as of rfcx/arbimon
                            // #2694; keeping this one on the legacy state was
                            // the single visible inconsistency between the two
                            // rails on a page a user can reach from either.
                            // NOTE externalRoute REQUIRES visibleCondition --
                            // a2-side-bar.html:87 calls it inside ng-if, so an
                            // entry without one throws and vanishes.
                            title: 'Visualizer',
                            visibleCondition: () => {
                                return true
                            },
                            externalRoute: '/p/' + url + '/visualizer'
                        },
                        {
                            title: 'Sites',
                            visibleCondition: () => {
                                return true
                            },
                            externalRoute: '/p/' + url + '/audiodata/sites'
                        },
                        {
                            title: 'Recordings',
                            visibleCondition: () => {
                                return true
                            },
                            externalRoute: '/p/' + url + '/audiodata/recordings'
                        },
                        {
                            title: 'Species',
                            visibleCondition: () => {
                                return true
                            },
                            externalRoute: '/p/' + url + '/audiodata/species'
                        },
                        {
                            // SPA PLAYLISTS (rfcx-local, operator 2026-09-16).
                            // The modern rail has pointed here since the
                            // 2026-08-28 per-page flag split shipped
                            // VITE_TOGGLE_PORT_PLAYLISTS=true to production
                            // (re-derived from the live bundle, not assumed).
                            title: 'Playlists',
                            visibleCondition: () => {
                                return true
                            },
                            externalRoute: '/p/' + url + '/analysis/playlists'
                        }
                    ]
                },
                {
                    title: 'Audio analyses',
                    iconRaw: 'fi-aed',
                    children: [
                        {
                            title: 'Active jobs',
                            route: 'jobs'
                        },
                        {
                            title: 'Pattern Matching',
                            visibleCondition: () => {
                                return true
                            },
                            route: 'analysis.patternmatching'
                        },
                        {
                            title: 'Random Forest Models',
                            route: 'analysis.random-forest-models.models'
                        },
                        {
                            title: 'Soundscape Analysis',
                            route: 'analysis.soundscapes'
                        },
                        {
                            title: 'Audio Event Detection',
                            visibleCondition: () => {
                                return a2UserPermit.has('aed')
                            },
                            route: 'analysis.audio-event-detections-clustering'
                        },
                        {
                            title: 'Clustering',
                            visibleCondition: () => {
                                return a2UserPermit.has('clustering')
                            },
                            route: 'analysis.clustering-jobs'
                        },
                        {
                            title: 'CNN',
                            visibleCondition: () => {
                                return $scope.isRfcx()
                            },
                            externalRoute: '/p/' + url + '/analyse/cnn'
                        },
                        {
                            title: 'Citizen Scientist',
                            visibleCondition: () => {
                                return a2UserPermit.has('citizen_scientist')
                            },
                            externalRoute: $scope.getUrlFor('citizen-scientist')
                        }
                        
                    ]
                },
                {
                    title: 'Ecological insights',
                    iconRaw: 'pres-chart-bar',
                    route: '/p/' + url + '/insights'
                },
                {
                    title: 'Project settings',
                    iconRaw: 'fi-settings',
                    children: [
                        {
                            title: 'Project information',
                            visibleCondition: () => {
                                return true
                            },
                            externalRoute: '/p/' + url + '/settings'
                        },
                        {
                            title: 'Members',
                            visibleCondition: () => {
                                return true
                            },
                            externalRoute: '/p/' + url + '/users'
                        }
                    ]
                }
            ]
        });
    }

    $scope.getUrlFor = function(page){
        const projectUrl = Project.getUrl()
        if (page == 'citizen-scientist'){
            return '/citizen-scientist/' + projectUrl + '/';
        } else if (page == 'reports') {
            return '/'
        } else if (page == 'my-projects') {
            return '/my-projects'
        }
    }

    $scope.itemId = function(title) {
        if (!title) return ''
        return 'sidebar-' + String(title).toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '')
    }

    $scope.menuState = Object.create(null);

    $scope.toggleMenu = function(index) {
        $scope.menuState[index] = !$scope.menuState[index]
    };

    $scope.collapse = function() {
        submenuEl = document.querySelectorAll('.submenu')
        mainmenuEl = document.querySelectorAll('.mainmenu')
        if ($scope.showSidebar === false) {
            mainmenuEl.forEach((el) => el.classList.add('collapsed'))
            submenuEl.forEach((el) => el.classList.remove('in'))
            $scope.menuState = Object.create(null);
        }
    }

    // =====================================================================
    // FLYOUT STATE MACHINE (2026-09-16, operator-directed convergence with the
    // modern rail). Mirrors the SPA's
    // apps/website/src/_layout/components/side-bar/use-nav-flyout.ts so the two
    // rails cannot drift in BEHAVIOUR the way they had drifted in link targets.
    //
    // The rail no longer widens on hover. Labels and submenus live in a panel
    // anchored to the RIGHT of the 52px rail, exactly like the SPA.
    //
    // Behaviour, copied deliberately rather than reinvented:
    //   - opens on HOVER *and* on CLICK/TAP -- hover alone is unusable on
    //     touch, where there is no hover state at all.
    //   - a HOVER-opened panel closes on pointer-out after GRACE_MS, so the
    //     pointer can cross the gap from trigger to panel without losing it.
    //   - a CLICK-opened panel is STICKY: it survives pointer-out and closes
    //     only on an outside click, or when another flyout opens.
    //   - opening any flyout closes the previous one, so two are never open.
    // =====================================================================
    var GRACE_MS = 220;
    var closeTimer = null;

    $scope.openFlyoutId = null;
    $scope.flyoutSticky = false;
    $scope.flyoutTop = 0;

    function cancelPendingClose() {
        if (closeTimer !== null) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }
    }

    // Align the panel with its trigger, then clamp it into the viewport. The
    // SPA had a MEASURED bug here (it clamped the wrong panel and overflowed by
    // 97px); anchoring to the trigger's own top and clamping against the
    // panel's height avoids reproducing it.
    function positionFlyout(triggerEl) {
        if (!triggerEl) return;
        var top = Math.round(triggerEl.getBoundingClientRect().top);
        $timeout(function () {
            var panel = document.querySelector('#a2Sidebar .a2-flyout');
            if (panel) {
                var maxTop = window.innerHeight - panel.getBoundingClientRect().height - 8;
                if (top > maxTop) top = Math.max(8, Math.round(maxTop));
            }
            $scope.flyoutTop = top;
        });
    }

    $scope.isFlyoutOpen = function (id) {
        return $scope.openFlyoutId === id;
    };

    $scope.closeFlyout = function () {
        cancelPendingClose();
        $scope.openFlyoutId = null;
        $scope.flyoutSticky = false;
    };

    // via: 'hover' | 'click'
    $scope.onFlyoutTrigger = function (event, id, via) {
        var el = event && (event.currentTarget || event.target);
        cancelPendingClose();
        if (via === 'hover') {
            if ($scope.openFlyoutId === id) return;
            $scope.openFlyoutId = id;
            $scope.flyoutSticky = false;
            positionFlyout(el);
            return;
        }
        // click/tap: toggle, and make it sticky
        if ($scope.openFlyoutId === id && $scope.flyoutSticky) {
            $scope.closeFlyout();
            return;
        }
        $scope.openFlyoutId = id;
        $scope.flyoutSticky = true;
        positionFlyout(el);
    };

    $scope.keepFlyoutOpen = function (id) {
        if ($scope.openFlyoutId === id) cancelPendingClose();
    };

    $scope.scheduleFlyoutClose = function (id) {
        if ($scope.flyoutSticky) return;      // click-opened panels persist
        if ($scope.openFlyoutId !== id) return;
        cancelPendingClose();
        closeTimer = setTimeout(function () {
            $scope.$applyAsync(function () {
                if (!$scope.flyoutSticky && $scope.openFlyoutId === id) {
                    $scope.openFlyoutId = null;
                }
                closeTimer = null;
            });
        }, GRACE_MS);
    };

    // An outside click dismisses a sticky panel. Bound once, cleaned up with
    // the scope so a destroyed directive cannot leak the handler.
    function onDocumentClick(e) {
        if (!$scope.flyoutSticky || $scope.openFlyoutId === null) return;
        var rail = document.getElementById('a2Sidebar');
        var panel = document.querySelector('#a2Sidebar .a2-flyout');
        var inRail = rail && rail.contains(e.target);
        var inPanel = panel && panel.contains(e.target);
        if (!inRail && !inPanel) {
            $scope.$applyAsync(function () { $scope.closeFlyout(); });
        }
    }
    document.addEventListener('click', onDocumentClick, true);
    $scope.$on('$destroy', function () {
        cancelPendingClose();
        document.removeEventListener('click', onDocumentClick, true);
    });

    $scope.initData()
})
;
