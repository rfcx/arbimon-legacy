var q     = require('q');
var dbpool = require('../utils/dbpool');

var AudioEventDetections = {
    getFor: function(options){
        return q.resolve([]);
    },
    getAlgorithms: function(){
        return dbpool.query(
            "SELECT id, name, description, defaults\n" +
            "FROM audio_event_detection_algorithms"
        ).then(function(algorithms){
            algorithms.forEach(function(algorithm){
                algorithm.defaults = JSON.parse(algorithm.defaults);
            });
            return algorithms;
        });
    },
    getStatistics: function(){
        return dbpool.query(
            "SELECT id, name, description\n" +
            "FROM audio_event_detection_statistics"
        );
    },
    
};

module.exports = AudioEventDetections;
