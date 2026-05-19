angular.module('visualizer-layers', ['visualizer-services', 'a2.utils'])
.directive('a2VisualizerLayerItem', function(layer_types, $compile, $templateFetch, Project){
    return {
        restrict : 'E',
        replace  : true,
        templateUrl : '/app/visualizer/layer-item/default.html',
        link: function(scope, element, attrs){
            var layer_type = layer_types[scope.layer.type] ? scope.layer.type : false;
            var layer_key  = layer_types[layer_type] ? layer_types[layer_type].type : null;
            
            if(layer_key && layer_key != 'default') {
                var layer_url  = '/app/visualizer/layer-item/' + layer_key + '.html';
                var layer_tmp  = $templateFetch(layer_url, function(layer_tmp){
                    var layer_el   = $compile(layer_tmp)(scope);
                    element.append(layer_el.children().unwrap());
                });
            }

            scope.tieringGuard = { loading: true };

            scope.loadTieringData = function() {
                scope.tieringGuard.loading = true;
                Project.getAnalysisTieringGuard()
                    .then(function(guard) {
                        // ใช้ angular.extend เพื่อรวมข้อมูลที่ได้จาก API เข้าไปใน tieringGuard
                        angular.extend(scope.tieringGuard, guard, { loading: false });
                    })
                    .catch(function() {
                        scope.tieringGuard.loading = false;
                    });
            };

            scope.loadTieringData();
        }
    };
});
