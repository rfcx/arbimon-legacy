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
    
    /** Fetches a set of audio event detections optionally matching a given query.
     * @param {Object} options - options object.
     * @param {Object} options.id - match aeds with the given id (or id array).
     * @param {Object} options.project - match aeds on projects with the given id (or id array).
     * @param {Object} options.showAlgorithm - show the algorithm details for this aed.
     * @return {Promise} resolving to the queried aeds.
     */
    getFor: function(options){
        options = options || {};
        var select=["AED.`aed_id` as id, AED.`project_id`, AED.`name`, AED.date_created as date"];
        var from=[
            "audio_event_detections AED",
            "JOIN audio_event_detection_algorithm_configurations AEDC ON AED.configuration_id = AEDC.aedc_id"
        ];
        var where=[], data=[];
        var postprocess=[];
        
        if(options.id){
            where.push("AED.aed_id IN (?)");
            data.push(options.id);
        }
        
        if(options.project){
            where.push("AED.project_id IN (?)");
            data.push(options.project);
        }
        
        if(options.showAlgorithm){
            select.push('AEDA.name as algorithm, AEDC.parameters, AED.`statistics`');
            from.push("JOIN audio_event_detection_algorithms AEDA ON AEDC.algorithm_id = AEDA.id");
            postprocess.push(function(aeds){
                aeds.forEach(function(aed){
                    aed.algorithm = {
                        name: aed.algorithm,
                        parameters: JSON.parse(aed.parameters)
                    };
                    aed.statistics = JSON.parse(aed.statistics);
                    delete aed.parameters;
                });
            });
        }
        
        return dbpool.query(
            "SELECT " + select.join(", ") + "\n" +
            "FROM " + from.join("\n")+ "\n" +
            (where.length ? "WHERE (" + where.join(") AND (") + ")" : ""),
            data
        ).then(function(aeds){
            return postprocess.length ? q.all(postprocess.map(function(ppfn){
                return q.resolve(aeds).then(ppfn);
            })).then(function(){
                return aeds;
            }) : aeds;
        });
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
