angular.module('a2.utils.external-api-loader', [
    'a2.utils.global-anonymous-function',
])
.provider('externalApiLoader', function(){
    var externalApiLoaderProvider = {
        apis:{},
        
        defaults:{
            getCachedModule: ["$window", function($window){
                return $window[this.def.namespace];
            }],
            loader: ["$window", "$q", "globalAnonymousFunction", function($window, $q, globalAnonymousFunction){
                var api = this;
                return $q(function(resolve, reject){
                    var url = api.def.url;
                    
                    var script = $window.document.createElement('script');
                    angular.element($window.document.head).append(script);
                    
                    if(api.def.jsonpCallback){
                        url += (/\?/.test(url) ? '&' : '?') + api.def.jsonpCallback + '=' + globalAnonymousFunction(
                            resolve, 
                            {oneTime:true}
                        ).id;
                    } else {
                        script.onload = resolve;
                    }
                    
                    script.onerror = function(){
                        reject();
                    };
                    
                    script.src = url;
                });
            }]
        },
        
        addApi : function(apiName, def){
            externalApiLoaderProvider.apis[apiName] = {
                name:apiName, 
                def:angular.extend({}, externalApiLoaderProvider.defaults, def)
            };
        },
        $get: function($q, $injector){
            var externalApiLoader = {
                load: function(apiName){
                    var api = externalApiLoaderProvider.apis[apiName];
                    
                    if(!api){
                        return $q.reject("Cannot load unconfigured external api " + apiName);
                    }                    
                    
                    if(!api.module){
                        api.module = $injector.invoke(api.def.getCachedModule, api);
                    }
                    
                    if(!api.promise){
                        if(api.module){
                            api.promise = $q.resolve(api.module);
                        } else {
                            api.promise = $q.resolve();
                            
                            if(api.def.parent){
                                api.promise = api.promise.then(function(){
                                    return externalApiLoader.load(api.def.parent);
                                }).then(function(){
                                    api.parent = externalApiLoaderProvider.apis[api.def.parent];
                                });
                            }
                            
                            api.promise = api.promise.then(function(){
                                return $injector.invoke(api.def.loader, api);
                            }).then(function(){
                                api.module = $injector.invoke(api.def.getCachedModule, api);
                            }).then(function(){
                                if(api.def.onload){
                                    return $injector.invoke(api.def.onload, api);
                                }
                            }).then(function(){
                                return api.module;
                            });
                        }
                    }
                    return api.promise;
                }                
            };
            return externalApiLoader;
        },
    };
    return externalApiLoaderProvider;
})
;