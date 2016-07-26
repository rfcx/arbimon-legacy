var q     = require('q');
var joi     = require('joi');
var dbpool = require('../utils/dbpool');
var sha256 = require('../utils/sha256');

var AudioEventDetections = {
    schema: {
        configuration: joi.object().keys({
            algorithm  : joi.number().integer(),
            params     : joi.object(),
        })
    },
    
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

    getConfiguration: function(aedc_id){
        return dbpool.query(
            "SELECT aedc_id, algorithm_id, parameters\n" +
            "FROM audio_event_detection_algorithm_configurations\n" + 
            "WHERE aedc_id = ?", [aedc_id]
        ).get(0);
    },
    
    newConfiguration: function(options){
        var hash;
        return q.ninvoke(joi, 'validate', options, AudioEventDetections.schema.configuration).then(function(){
            hash = sha256(JSON.stringify(
                {algorithm:options.algorithm, params:options.params}
            ));
            
            return dbpool.query(
                "SELECT aedc_id\n" +
                "FROM audio_event_detection_algorithm_configurations\n" + 
                "WHERE hash = ?", [hash]
            ).get(0);
        }).then(function(aedc){
            if(aedc){
                return aedc.aedc_id;
            } else {
                return dbpool.query(
                    "INSERT INTO audio_event_detection_algorithm_configurations(algorithm_id, parameters, hash)\n" +
                    "VALUES (?, ?, ?)", [
                    options.algorithm, JSON.stringify(options.params), hash
                ]).then(function(result){
                    return result.insertId;
                });
            }
        }).then(function(aedc_id){
            return AudioEventDetections.getConfiguration(aedc_id);
        });
    },
    
};

module.exports = AudioEventDetections;
