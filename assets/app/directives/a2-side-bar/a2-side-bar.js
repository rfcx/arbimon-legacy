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
                    route: $scope.arbimonUrl + '/p/' + url + '/dashboard'
                },
                {
                    title: 'Import',
                    iconRaw: 'cloud-upload',
                    children: [{
                        title: 'Recordings',
                        route: 'audiodata.uploads.upload'
                    }]
                },
                {
                    title: 'Explore',
                    iconRaw: 'fa-search',
                    children: [
                        {
                            title: 'Visualizer',
                            route: 'visualizer'
                        },
                        {
                            title: 'Sites',
                            route: 'audiodata.sites'
                        },
                        {
                            title: 'Recordings',
                            route: 'audiodata.recordings'
                        },
                        {
                            title: 'Species',
                            route: 'audiodata.species'
                        },
                        {
                            title: 'Playlists',
                            route: 'audiodata.playlists'
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
        return 'sidebar-' + title.toLowerCase().replace(' ', '-')
    }

    $scope.collapse = function() {
        submenuEl = document.querySelectorAll('.submenu')
        mainmenuEl = document.querySelectorAll('.mainmenu')
        if ($scope.showSidebar === false) {
            mainmenuEl.forEach((el) => el.classList.add('collapsed'))
            submenuEl.forEach((el) => el.classList.remove('in'))
        }
    }

    $scope.initData()
})
;
