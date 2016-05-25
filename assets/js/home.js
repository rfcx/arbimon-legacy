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
    'a2.srv.local-storage',
    'a2.directive.news-feed-item',
])
.config(function(AngularyticsProvider) {
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
    
    this.loadProjectList = function() {
        $http.get('/api/user/projectlist').success((function(data) {
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
        $window.location.assign("/project/" + project.url + "/");
    };
    
    
    this.currentPage = 1;
    this.isAnonymousGuest = true;
    var nextNewsPage = 0;
    this.newsFeed = [];
    this.loadProjectList();
    this.loadNewsPage();
    
    $http.get('/api/user/info').success((function(data) {
        this.isAnonymousGuest = data.isAnonymousGuest;
    }).bind(this));
})

;
