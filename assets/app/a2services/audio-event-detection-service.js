angular.module('a2.service.audio-event-detection', [
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
        getDataStatisticsList: function(){
            return a2APIService.get('/audio-event-detections/data/statistics');
        },
        getDataAggregatesList: function(){
            return a2APIService.get('/audio-event-detections/data/aggregates');
        },
        
        getDataFor: function(aed, x, y, z){
            var args=[];
            
            return a2APIService.get('/audio-event-detections/data/' + [
                aed, x.statistic, y.statistic, z.statistic
            ].map(encodeURIComponent).join('/') + '?' + args.join('&'));
            
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