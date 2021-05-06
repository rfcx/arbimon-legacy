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
])
.config(function(AngularyticsProvider, $locationProvider) {
    AngularyticsProvider.setEventHandlers(['GoogleUniversal']);
})
.run(function(Angularytics) {
    Angularytics.init();
})
.controller('HomeCtrl', function(
    $http,
    $window,
    $localStorage,
    notify, a2order,
    a2InjectedData,
    $scope
) {
    $scope.search = '';
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
        } catch(e){
            // meh..
        }
    }

    this.loadProjectList = function() {
        var config = {
            params: {
                include_location: true,
                allAccessibleProjects: true
            }
        };
        if ($window.location.pathname === '/home' && !this.isAnonymousGuest) {
            config.params.type = 'my'
        }
        var psCache = getProjectSelectCache();
        $http.get('/api/user/projectlist', config).success((function(data) {
            data.forEach(function(p){
                p.lastAccessed = psCache[p.id] || 0;
                var lat = p.lat && p.lat >= -85.0511 && p.lat <= 85.0511? p.lat : 37.773972;
                var lon = p.lon && p.lon >= -180 && p.lon <= 180? p.lon : -122.431297;
                var zoom = p.lat && p.lon ? 5.33 : 4
                p.mapUrl = "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/" + lon + "," + lat + "," + zoom + ",0,60/274x180?access_token=" + a2InjectedData.mapbox_access_token
            });
            this.projects = data;
        }).bind(this));
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

    this.selectProject = function(project) {
        if (!project.is_enabled) {
            return;
        }
        var psCache = getProjectSelectCache();
        psCache[project.id] = new Date().getTime();
        setProjectSelectCache(psCache);
        $window.location.assign("/project/" + project.url + "/");
    };

    this.sortProjects = function(sortingKey){
        console.log("sortProjects", sortingKey);
        var sorting = projectSorts[sortingKey];
        if(!sorting){
            if(this.projectSort.type == sortingKey){
                if(projectSorts[this.projectSort.toggle]){
                    sorting = projectSorts[this.projectSort.toggle];
                }
            } else if(projectSorts[sortingKey + '-down']){
                sorting = projectSorts[sortingKey + '-down'];
            }
        }
        this.projectSort = sorting || projectSorts.default;
    };

    this.toggleSearchVis = function() {
        this.showSearch = !this.showSearch;
        if (!this.showSearch) {
            this.search = '';
        }
        else {
            setTimeout(function() { // if we do it immidiately, element is not yet shown
                var el = document.getElementById('projectsSearch')
                if (el) {
                    el.focus();
                }
            }, 100)
        }
    };

    this.searchChanged = function() {
        if ($scope.search === '') {
            this.deleteAllRank();
            this.projectSort = projectSorts['history-down'];
            return;
        }
        $scope.regExp = new RegExp($scope.search, 'gi');
        this.projectSort = projectSorts['rank-down'];
    }

    this.deleteAllRank = function() {
        if (this.projects) {
            this.projects.forEach(project => {
                delete project['rank'];
            })
        }
    }

    this.customSearch = function(item) {
        if (!$scope.search) return true;
        if (item.name.match($scope.regExp)) {
            item.rank = 1;
            return true;
        }
        else if (item.description && item.description.match($scope.regExp)) {
            item.rank = 2;
            return true;
        }
        return false
    }

    var projectSorts = [
        {key:'alpha-down', sort:'+name'},
        {key:'alpha-up', sort:'-name'},
        {key:'history-down', sort:['+name','-lastAccessed'], default:true},
        {key:'history-up', sort:['+name','+lastAccessed']},
        {key:'rank-down', sort:['rank', '+name']}
    ].reduce(function(_, sorting){
        var m = /(\w+)-(\w+)/.exec(sorting.key);
        sorting.type = m[1];
        sorting.toggle = m[1] + '-' + (m[2] == 'up' ? 'down' : 'up');
        _[sorting.key] = sorting;
        if(sorting.default){
            _.default = sorting;
        }
        return _;
    }, {});

    this.projectSort = projectSorts['history-down'];

    this.currentPage = 1;
    this.isAnonymousGuest = true;
    this.showSearch = false;

    $http.get('/api/user/info').success((function(data) {
        this.isAnonymousGuest = data.isAnonymousGuest;
        this.loadProjectList();
    }).bind(this));
})

;
