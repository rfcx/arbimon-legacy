angular.module('a2.home', [
    'templates-arbimon2',
    'ui.bootstrap',
    'a2.utils',
    'a2.forms',
    'a2.orders',
    'a2.login',
    'a2.srv.news',
    'humane',
    'angularytics',
    'ui.router',
    'a2.srv.local-storage',
    'a2.filter.time-from-now',
    'a2.directive.news-feed-item',
])
.config(function(AngularyticsProvider, $locationProvider) {
    AngularyticsProvider.setEventHandlers(['GoogleUniversal']);
})
.run(function(Angularytics) {
    Angularytics.init();
})
.controller('HomeCtrl', function(
    $http, $modal,
    $window,
    $localStorage,
    a2NewsService,
    notify, a2order
) {
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
            params: {}
        };
        if ($window.location.pathname === '/home') {
            config.params.type = 'my'
        }
        var psCache = getProjectSelectCache();
        $http.get('/api/user/projectlist', config).success((function(data) {
            data.forEach(function(p, $index){
                p.lastAccessed = psCache[p.id] || 0;
            });
            this.projects = data;
        }).bind(this));
    };

    this.loadNewsPage = function() {
        a2NewsService.loadPage(nextNewsPage).then((function(data) {
            this.newsFeed = this.newsFeed.concat(data);
            nextNewsPage++;
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

    var projectSorts = [
        {key:'alpha-down', sort:'+name'},
        {key:'alpha-up', sort:'-name'},
        {key:'history-down', sort:['-lastAccessed', '+name'], default:true},
        {key:'history-up', sort:['+lastAccessed', '+name']}
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
    var nextNewsPage = 0;
    this.newsFeed = [];
    this.loadProjectList();
    this.loadNewsPage();

    $http.get('/api/user/info').success((function(data) {
        this.isAnonymousGuest = data.isAnonymousGuest;
    }).bind(this));
})

;
