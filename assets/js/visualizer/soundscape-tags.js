angular.module('a2SoundscapeRegionTags', ['a2Infotags'])
.directive('a2SoundscapeRegionTag', function($injector){
    var resolve_tag = function(scope, element, tag){
        var txt = element.children('.txt');
        var label_classes = ['default', 'primary', 'success', 'info', 'warning', 'danger'];        
        var default_colors_by_type = {species_sound:'blue'};
        if(!tag){
            element.hide();
        } else {
            element.show();
        }
        
        scope.class="";
        scope.style={}; 
        
        if(typeof tag == 'string'){
            txt.text(tag);
            scope.class="label-default";
        } else {
            var type  = tag.type;
            var text  = tag.text || tag.tag;
            var color = tag.color || 'default';
            
            scope.count = tag.count === undefined ? '' : (tag.count | 0);
            
            if(type == 'species_sound'){
                $injector.invoke(resolve_species_tag, this, {
                    element : txt, text : text,
                    $scope  : scope
                });
            } else {
                type = 'normal';
                txt.text(text);
            }           
            
            if(color == 'default' && default_colors_by_type[type]){
                color = default_colors_by_type[type];
            }
            
            if(label_classes.indexOf(color) >= 0){
                scope.class = 'label-'+color;
            } else {
                scope.style['background-color'] = color;
            }

        }        
    };
    
    var resolve_species_tag = function(element, text, InfoTagService, $compile, $scope){
        element.empty().append($compile('<a2-species species="'+(text|0)+'"></a2-species species>')($scope));
    };
    
    return {
        restrict : 'E',
        scope : {
            tag     : '=',
            closeable: '=?',
            showCount: '=?',
            onClose : '&'
        },
        replace : true,
        templateUrl : '/partials/visualizer/soundscape-region-tag.html',
        link     : function(scope, element, $attrs){
            scope.$watch('tag', function(tag){
                resolve_tag(scope, element, tag);
            });
        }
    };
})
;
            
