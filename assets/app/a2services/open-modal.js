angular.module('a2.srv.open-modal', [
    'ui.bootstrap.modal'
])
.provider('$openModal', function(){
    var $openModalProvider = {
        defs:{},
        define: function(modalName, modalDef){
            $openModalProvider.defs[modalName] = angular.extend({}, modalDef);
        },
        $get: function($modal){
            return function $openModal(modalName, overrides){
                var options = angular.extend({}, $openModalProvider.defs[modalName]);
                
                if(overrides){
                    if(overrides.resolve){
                        console.log("overrides.resolve", overrides.resolve);
                        options.resolve = angular.extend(options.resolve, overrides.resolve);
                        console.log("options.resolve", options.resolve);
                        delete overrides.resolve;
                    }
                    
                    options = angular.extend(options, overrides);
                    
                }                
                
                return $modal.open(options);
            };
        }
    };
    
    return $openModalProvider;
})
;