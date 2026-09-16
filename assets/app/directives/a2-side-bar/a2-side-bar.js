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
.controller('a2SideBarCtrl', function($scope, $state, Project, a2UserPermit) {

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
            $scope.arbimonUrl = info.bioAnalyticsBaseUrl
            $scope.accountSettings = $scope.arbimonUrl + '/account-settings'
            $scope.allItems  = [
                {
                    title: 'Overview',
                    iconRaw: 'fi-grid',
                    public: true,
                    route: $scope.arbimonUrl + '/p/' + url + '/overview'
                },
                {
                    title: 'Import',
                    iconRaw: 'cloud-upload',
                    route: $scope.arbimonUrl + '/p/' + url + '/import-recordings'
                },
                {
                    title: 'Explore',
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
                            externalRoute: $scope.arbimonUrl + '/p/' + url + '/visualizer'
                        },
                        {
                            title: 'Sites',
                            visibleCondition: () => {
                                return true
                            },
                            externalRoute: $scope.arbimonUrl + '/p/' + url + '/audiodata/sites'
                        },
                        {
                            title: 'Recordings',
                            visibleCondition: () => {
                                return true
                            },
                            externalRoute: $scope.arbimonUrl + '/p/' + url + '/audiodata/recordings'
                        },
                        {
                            title: 'Species',
                            visibleCondition: () => {
                                return true
                            },
                            externalRoute: $scope.arbimonUrl + '/p/' + url + '/audiodata/species'
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
                            externalRoute: $scope.arbimonUrl + '/p/' + url + '/analysis/playlists'
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
                            externalRoute: $scope.arbimonUrl + '/p/' + url + '/analyse/cnn'
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
                    route: $scope.arbimonUrl + '/p/' + url + '/insights'
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
                            externalRoute: $scope.arbimonUrl + '/p/' + url + '/settings'
                        },
                        {
                            title: 'Members',
                            visibleCondition: () => {
                                return true
                            },
                            externalRoute: $scope.arbimonUrl + '/p/' + url + '/users'
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
            return $scope.arbimonUrl
        } else if (page == 'my-projects') {
            return $scope.arbimonUrl + '/my-projects'
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

    $scope.initData()
})
;
