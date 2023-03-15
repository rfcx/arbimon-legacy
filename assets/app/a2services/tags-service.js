angular.module('a2.srv.tags', ['a2.srv.api'])
.factory('a2Tags', function($q, a2APIService, notify) {
    function isTaggableType(type){
        return /^recording$/.test('' + type);
    }
    function isTaggableResource(obj){
        return obj && isTaggableType(obj.type) && obj.id;
    }
    return {
        getFor : function(visobject){
            if(isTaggableResource(visobject)){
                return a2APIService.get('/tags/' + visobject.type + '/' + (visobject.id|0));
            } else {
                return $q.resolve([]);
            }
        },
        getForType : function(resourceType){
            if(isTaggableType(resourceType)){
                return a2APIService.get('/tags/' + resourceType);
            } else {
                return $q.resolve([]);
            }            
        },
        deleteFor : function(visobject, tagId){
            if(isTaggableResource(visobject)){
                return a2APIService.delete('/tags/' + visobject.type + '/' + (visobject.id|0) + '/' + tagId);
            } else {
                return $q.resolve([]);
            }
        },
        addFor : function(visobject, tag){
            if(isTaggableResource(visobject)){
                var data={};
                if(tag.tag_id){
                    data.id = tag.tag_id;
                } else {
                    data.text = tag.tag;
                }
                if(tag.t0 !== undefined){
                    data.t0 = tag.t0;
                    data.f0 = tag.f0;
                    data.t1 = tag.t1;
                    data.f1 = tag.f1;
                }
                return a2APIService.put('/tags/' + visobject.type + '/' + (visobject.id|0), data).catch(notify.serverError)
            } else {
                return $q.resolve([]);
            }
        },
        search: function(text){
            return a2APIService.get('/tags/?q=' + text);
        }
    };
})
;
