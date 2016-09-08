angular.module('a2.visobjects.common', [
])
.provider('VisualizerObjectTypes', function () {
    var types={};
    var defers={};
    return {
        add: function(typeDef){
            types[typeDef.type] = angular.extend(types[typeDef.type] || {}, typeDef);
        },
        $get: function($injector){
            return {
                types: types,
                getLoader: function(type){
                    if(!types[type]){
                        throw new Error("Visualizer Object Type '" + type + "' not found");
                    }
                    return $injector.invoke(types[type].$loader);
                }
            };
        }
    };
})
;
