angular.module('a2.srv.soundscape-composition', [
    'a2.srv.api'
])
.factory('a2SoundscapeCompositionService', function($q, a2APIService) {
    return {
        getClassList: function(options){
            options = options || {};
            var params = {};
            if(options.tally){
                params.tally=1;
            }
            return a2APIService.get('/soundscape-composition/classes', {params:params}).then(function(classList){
                if(options.groupByType){
                    return classList.reduce(function(_, item){
                        if(!_.index[item.type]){
                            _.list.push(_.index[item.type] = {
                                type: item.type,
                                list: []
                            });
                        }
                        _.index[item.type].list.push(item);
                        return _;
                    }, {list:[], index:{}}).list;
                } else {
                    return classList;
                }
            });
        },
        getAnnotationsFor: function(visobject){
            if(visobject && /^recording$/.test(visobject.type)){
                return a2APIService.get('/soundscape-composition/annotations/' + (visobject.id|0));
            } else {
                return $q.resolve([]);
            }
        },
        annotate: function(visobject, annotation){
            if(visobject && /^recording$/.test(visobject.type)){
                return a2APIService.post('/soundscape-composition/annotate/' + (visobject.id|0), annotation);
            } else {
                return $q.reject(new Error("Cannot add soundscape composition annotation" + (visobject ? " to " + visobject.type : "") + "."));
            }
        }
    };
})
;