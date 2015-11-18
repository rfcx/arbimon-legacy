angular.module('a2.srv.tags', ['a2.srv.api'])
.factory('a2Tags', function($q, a2APIService) {
    function isTaggableResource(obj){
        return obj && /^recording$/.test(obj.type) && obj.id;
    }
    return {
        getFor : function(visobject){
            if(isTaggableResource(visobject)){
                return a2APIService.get('/tags/' + visobject.type + '/' + (visobject.id|0));
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
                return a2APIService.put('/tags/' + visobject.type + '/' + (visobject.id|0), data);
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