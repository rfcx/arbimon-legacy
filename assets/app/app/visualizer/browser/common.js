angular.module('a2.browser_common', [])
.provider('BrowserLOVOs', function(){
    var lovos = {$grouping : [], $list:[]};
    
    return {
        add: function(lovo){
            lovos.$list.push(lovo);
        },
        $get: function(){
            lovos.$grouping = lovos.$list.reduce(function(_, lovodef){
                var group = lovodef.group || '';

                if(!_.$index[group]){
                    _.groups.push(_.$index[group] = []);
                }

                _.$index[group].push(lovos[lovodef.name] = lovodef);

                return _;
            }, {groups:[], $index:{}}).groups;
            
            return lovos;
        }
    };
})
.service('a2ArrayLOVO', function($q){
    var lovo = function(list, object_type){
        this.offset = 0;
        this.setArray(list, object_type);
    };

    lovo.prototype = {
        initialize: function(){
            var d = $q.defer();
            d.resolve(true);
            return d.promise;
        },
        setArray : function(list, object_type){
            this.list   = list || [];
            this.count  = this.list.length;
            this.object_type = object_type;
        },
        find : function(soundscape){
            var d = $q.defer(), id = (soundscape && soundscape.id) || (soundscape | 0);
            d.resolve(this.list.filter(function(r){
                return r.id == id;
            }).shift());
            return d.promise;
        },
        previous : function(soundscape){
            var d = $q.defer(), id = (soundscape && soundscape.id) || (soundscape | 0);
            var index = 0;
            for(var l=this.list, i=0, e=l.length; i < e; ++i){
                if(s.id == id){
                    index = Math.min(Math.max(0, i - 1, this.list.length-1));
                    break;
                }
            }
            d.resolve(this.list[index]);
            return d.promise;
        },

        next : function(recording){
            var d = $q.defer(), id = (soundscape && soundscape.id) || (soundscape | 0);
            var index = 0;
            for(var l=this.list, i=0, e=l.length; i < e; ++i){
                if(s.id == id){
                    index = Math.min(Math.max(0, i + 1, this.list.length-1));
                    break;
                }
            }
            d.resolve(this.list[index]);
            return d.promise;
        }
    };

    return lovo;
})
;
