angular.module('a2.browser_common', [])
.service('BrowserLOVOs', function(){
    var g=[], i={}, lovos = {$grouping : g};
    (lovos.$list = [
        {   name       : 'rec',
            group       : 'recordings',
            vobject_type: 'recording',
            default    : true,
            icon       : 'fa fa-map-marker',
            tooltip    : 'Browse Recordings by Site',
            controller : 'a2BrowserRecordingsBySiteController',
            template   : '/app/visualizer/browser/recordings-by-site.html'
        },
        {   name       : 'playlist',
            group       : 'recordings',
            vobject_type: 'recording',
            icon       : 'fa fa-list',
            tooltip    : "Browse Recordings by Playlist",
            controller : 'a2BrowserRecordingsByPlaylistController',
            template   : '/app/visualizer/browser/recordings-by-playlist.html'
        },
        {   name       : 'soundscape',
            group       : 'soundscapes',
            vobject_type: 'soundscape',
            icon       : 'fa fa-area-chart',
            tooltip    : "Show Soundscapes",
            controller : 'a2BrowserSoundscapesController',
            template   : '/app/visualizer/browser/soundscapes.html'
        }
    ]).forEach(function(lovodef){
        var group = lovodef.group || '';

        if(!i[group]){
            g.push(i[group] = []);
        }

        i[group].push(lovos[lovodef.name] = lovodef);
    });

    return lovos;
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
