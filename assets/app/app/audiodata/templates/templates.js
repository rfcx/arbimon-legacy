angular.module('a2.audiodata.templates', [
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'humane'
])
.config(function($stateProvider) {
    $stateProvider.state('audiodata.templates', {
        url: '/templates',
        controller: 'TemplatesCtrl as controller',
        templateUrl: '/app/audiodata/templates/templates.html'
    });
})
.controller('TemplatesCtrl', function($state, $scope, a2Templates, Project, $q, a2UserPermit, notify) {
    Object.assign(this, {
        initialize: function(){
            this.loading = {list:false};
            this.templates = [];
            this.getList();
            this.projecturl = Project.getUrl();
        },
        getList: function(){
            this.loading.list = true;
            return a2Templates.getList().then((function(data){
                console.log('data', data);
                this.loading.list = false;
                this.templates = data;//.map(function(d) {
                    // d.date_created = new Date(d.date_created);
                    // return d;
                // });
            }.bind(this)));
        },
    });
    this.initialize();
})
;
