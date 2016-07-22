angular.module('a2.analysis.audio-event-detection.service', [
    'a2.srv.api'
])
.factory('AudioEventDetectionService', function(a2APIService){
    var AudioEventDetectionService = {
        getList: function(){
            return a2APIService.get('/audio-event-detections/');
        },
        getAlgorithmsList: function(){
            return a2APIService.get('/audio-event-detections/algorithms');
        },
        getStatisticsList: function(){
            return a2APIService.get('/audio-event-detections/statistics');
        },
        
        new: function(aed){
            aed = aed || {};
            var params = {
                name : aed.name || aed.defaultName,
                algorithm : aed.algorithm.id,
                parameters : aed.parameters,
                statistics: aed.statistics.map(function(statistic){
                    return statistic.id;
                }),
                playlist: aed.playlist.id,
            };
            
            return a2APIService.post('/audio-event-detections/new', params);
        }
    };
    
    return AudioEventDetectionService;
})
;