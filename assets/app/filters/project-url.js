angular.module('a2.filter.project-url', [
])
.filter('projectUrl', function(a2APIService){
    return function(url){
        return a2APIService.project.getUrl(url);
    };
});