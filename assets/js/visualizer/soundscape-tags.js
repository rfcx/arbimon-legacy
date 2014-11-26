angular.module('a2SoundscapeRegionTags', [
'templates-arbimon2'
])
.directive('a2SoundscapeRegionTag', function(){
    var resolve_tag = function($scope, $element, $tag){
        if(!$tag){
            $element.hide();
        } else {
            $element.show();
        }
        
        console.log($tag, $scope);
        if(typeof $tag == 'string'){
            $element.find('.txt').text($tag);
            $scope.class="label-default";
            $scope.style={}; 
        }
    };
    
    return {
        restrict : 'E',
        scope : {
            tag     : '=',
            closable: '=?',
            onClose : '&'
        },
        replace : true,
        templateUrl : '/partials/visualizer/soundscape-region-tag.html',
        link     : function($scope, $element, $attrs){
            $scope.$watch('tag', function(tag){
                resolve_tag($scope, $element, tag);
            })
        }
    }
})
;
            