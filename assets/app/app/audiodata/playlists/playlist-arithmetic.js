angular.module('a2.audiodata.playlists.playlist-arithmetic', [
])
.directive('playlistArithmetic', function(a2Playlists){
    return {
        restrict:'E',
        templateUrl:'/app/audiodata/playlists/playlist-arithmetic.html',
        scope:{
            onExpressionSelected : '&',
        },
        controller:'playlistArithmeticController as controller',
        requires:'^PlaylistCtrl',
        link: function(scope, element, attrs) {
            var controller = scope.controller;

            controller.initialize({
                onSelected : function(expression) {
                    scope.onExpressionSelected({expression: expression});
                }
            });
            
            scope.$on('$destroy', function(){
                controller.$destroy();
            });
        }
    };
})
.controller('playlistArithmeticController', function(a2Playlists, $interpolate){
    this.selected={};
    this.operations = [
        {type:'union', text:'Join playlist 1 and 2', icon:'a2-union', nameTemplate : '{{playlist1}} joined with {{playlist2}}'},
        {type:'intersection', text:'Intersect playlist 1 and 2', icon:'a2-intersect', nameTemplate : '{{playlist1}} intersected with {{playlist2}}'},
        {type:'subtraction', text:'Remove playlist 2 from playlist 1', icon:'a2-difference', nameTemplate : '{{playlist1}} minus {{playlist2}}'},
    ];
    var removeOnInvalidateHandler;
    
    this.initialize = function(options){
        this.options = options || {};
        removeOnInvalidateHandler = a2Playlists.$on('invalidate-list', (function(){
            this.reset();
        }).bind(this));
        this.reset();
        this.updateNamePlaceholder();
    };
    
    this.reset = function(){
        return a2Playlists.getList().then((function(playlists){
            this.playlists = playlists;
        }).bind(this));
        
    };
    
    this.$destroy = function(){
        removeOnInvalidateHandler();
    };
    
    this.updateNamePlaceholder = function(){
        var nameTemplate = (this.selected.operation || {}).nameTemplate || 'Playlist 3';
        var term1 = this.selected.term1 || {};
        var term2 = this.selected.term2 || {};
        
        this.namePlaceholder = $interpolate(nameTemplate)({
            playlist1: term1.name || '(playlist 1)',
            playlist2: term2.name || '(playlist 2)',
        });
    };
    
    this.submit = function(){
        var operation = this.selected.operation;
        var term1 = this.selected.term1;
        var term2 = this.selected.term2;
        var name = this.selected.name || this.namePlaceholder;
        if(operation && term1 && term2 && name){
            if(this.options.onSelected){
                this.options.onSelected({
                    operation: operation.type,
                    term1: term1.id,
                    term2: term2.id,
                    name: name
                });
            }
        }
    };

})
;
