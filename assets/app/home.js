angular.module('a2.home', [
    'templates-arbimon2',
    'ui.bootstrap',
    'a2.utils',
    'a2.forms',
    'a2.orders',
    'a2.login',
    'humane',
    'angularytics',
    'ui.router',
    'a2.srv.local-storage',
    'a2.filter.time-from-now',
    'a2.directive.search-bar',
    'ngSanitize'
])
.config(function(AngularyticsProvider, $locationProvider) {
    AngularyticsProvider.setEventHandlers(['GoogleUniversal']);
})
.run(function(Angularytics) {
    Angularytics.init();
})
.service('homeSummaryStatsData', function() {
    return [
        {   title:'projects created',
            getData: function($http){
                return $http.get('/api/project/projects-count').then(function(projects) {
                    return projects.data;
                });
            },
        },
        {   title:'recordings uploaded',
            getData: function($http){
                return $http.get('/api/project/recordings-count').then(function(recordings) {
                    return recordings.data;
                });
            },
        },
        {   title:'analyses performed',
            description: 'Number of files processed by pattern matching jobs',
            getData: function($http){
                return $http.get('/api/project/jobs-count').then(function(jobs) {
                    return jobs.data;
                });
            },
        },
        {   title: 'species identified',
            getData: function($http){
                return $http.get('/api/project/recordings-species-count').then(function(species) {
                    return species.data;
                });
            },
        }
    ];
})
.controller('HomeCtrl', function(
    $http,
    $window,
    $localStorage,
    notify, a2order,
    a2InjectedData,
    $scope,
    $q,
    $injector,
    homeSummaryStatsData
) {
    $scope.summaryDataLoading = true;
    $scope.list_summary_data = homeSummaryStatsData;
    $scope.summary_data = $scope.list_summary_data.map(function(){
        return [];
    });

    function getSummaryData(summary_item){
        return $q.resolve(summary_item.getData ?
            $injector.invoke(summary_item.getData) : []
        );
    }

    $q.all($scope.list_summary_data.map(getSummaryData)).then((function(allData){
        $scope.summaryDataLoading = false;
        $scope.summary_data = allData;
    }).bind(this));

    $scope.isExplorePage = $window.location.pathname === '/';

    function getProjectSelectCache(){
        try{
            return JSON.parse($localStorage.getItem('home.project.select.cache')) || {};
        } catch(e){
            return {};
        }
    }

    function setProjectSelectCache(psCache){
        try{
            $localStorage.setItem('home.project.select.cache', JSON.stringify(psCache));
        } catch(e) { }
    }

    this.loadProjectList = function() {
        const isFeatured = $scope.isAnonymousGuest || $scope.isExplorePage;
        const isMyProjects = !$scope.isAnonymousGuest && !$scope.isExplorePage;
        var config = {
            params: {
                include_location: true,
                publicTemplates: true
            }
        };
        if (isFeatured) {
            config.params.featured = true;
        }
        if (isMyProjects) {
            config.params.type = 'my'
        }
        var psCache = getProjectSelectCache();
        this.isLoading = true;
        this.projects = [];
        this.highlightedProjects = [];
        $http.get('/api/user/projectlist', config).success(function(data) {
            data.forEach(function(p){
                p.lastAccessed = psCache[p.id] || 0;
                var lat = p.lat && p.lat >= -85.0511 && p.lat <= 85.0511? p.lat : 37.773972;
                var lon = p.lon && p.lon >= -180 && p.lon <= 180? p.lon : -122.431297;
                var zoom = p.lat && p.lon ? 5.33 : 4
                p.mapUrl = "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/" + lon + "," + lat + "," + zoom + ",0,60/274x180?access_token=" + a2InjectedData.mapbox_access_token
            });
            this.isLoading = false
            if (isFeatured) {
                this.projects = [];
                this.highlightedProjects = data.filter(item => item.featured === 1);
                this.highlightedProjects.forEach(project => {
                    project.isLoading = true;
                    $http.get('/api/project/' + project.url + '/templates/count', { params: { projectTemplates: true } }).success(function(data) {
                        project.templatesTotal = data.count || 0;
                        project.isLoading = false;
                    });
                    $http.get('/api/project/' + project.url + '/recordings/count').success(function(count) {
                        project.recCount = count;
                        project.isLoading = false;
                    })
                    $http.get('/api/project/' + project.url + '/species-count').success(function(count) {
                        project.speciesCount = count || 0;
                        project.isLoading = false;
                    })
                });
            }
            else if (isMyProjects) {
                this.highlightedProjects = [];
                this.projects = data;
            }
        }.bind(this))
        .error(function() {
            this.isLoading = false
        }.bind(this))
    };

    this.createProject = function() {
        var modalInstance = a2order.createProject({});

        modalInstance.result.then((function(message) {
            if(message){
                notify.log(message);
            }
            this.loadProjectList();
        }).bind(this));
    };

    $http.get('/api/project/bioAnalyticsBaseUrl').success(function(url) {
        $scope.bioAnalyticsBaseUrl = url
    })

    this.selectProject = function(project) {
        if (!project.is_enabled) {
            return;
        }
        var psCache = getProjectSelectCache();
        psCache[project.id] = new Date().getTime();
        setProjectSelectCache(psCache);
        const isMyProjects = !$scope.isAnonymousGuest && !$scope.isExplorePage;
        if (isMyProjects) {
            $window.location.assign("/project/" + project.url + "/");
        } else {
            $window.open($scope.bioAnalyticsBaseUrl + "/" + project.url, "_self")
        }
    };

    $scope.isAnonymousGuest = true;

    $http.get('/api/user/info').success((function(data) {
        $scope.isAnonymousGuest = data.isAnonymousGuest;
        this.loadProjectList();
    }).bind(this));

    this.valueShortScale = function(value) {
        if (value && Number(value) > 999999999) {
            value = value.toString().substring(0, 4)
            console.log(value)
            const formattedNumber = numeral(value.toString().substring(0, 4)).format('0,0')
            value = formattedNumber + ' million'
            return value
        }
        else {
            return numeral(value).format('0,0')
        }
        // const formattedNumber = numeral(value).format('0.0a')
        // const firstDecimalDigit = (x) => x.split('.')[1].slice(0, 1)
        // return firstDecimalDigit(formattedNumber) === '0' ? formattedNumber.replace('.0', '') : formattedNumber
    }
})

;
