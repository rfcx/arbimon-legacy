var q     = require('q');
var joi     = require('joi');
var fs     = require('fs');
var offlinePlotter = require('../utils/offline-plotter');
var tmpfilecache = require('../utils/tmpfilecache');
var model     = require('./index');
var AWS   = require('aws-sdk');
var dbpool = require('../utils/dbpool');
var sha256 = require('../utils/sha256');
var config = require('../config');
var s3;

function generateDataMatrix(N, M, data, statistic){
    var m = [], r;
    var zreducer = statistic.fn;
    for(var j=0; j < N; ++j){
        m.push(r = []);
        for(var i=0; i < M; ++i){
            r.push(0);
        }
    }
    
    data.forEach(function(datum){
        var x0 = Math.max(0, Math.min(datum.x_0 || datum.x, M));
        var x1 = Math.max(0, Math.min(datum.x_1 || datum.x, M));
        var y0 = Math.max(0, Math.min(datum.y_0 || datum.y || 0, N));
        var y1 = Math.max(0, Math.min(datum.y_1 || datum.y || 0, N));
        var z  = datum.z || 1;
        for(var y = y0; y <= y1; ++y){
            var row = m[y];
            if(row){
                for(var x = x0; x <= x1; ++x){
                    row[x] += z;
                }
            }
        }
    });
    
    if(zreducer){
        m.forEach(function(r){
            r.forEach(function(v, j){
                r[j] = zreducer(v);
            });
        });
    }
    
    return m;
}

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
     * @param {Object} options.showPlaylist - show the playlist details for this aed.
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

        if(options.showPlaylist){
            select.push('AED.playlist_id');
            postprocess.push(function(aeds){
                return q.all(aeds.map(function(aed){
                    return q.ninvoke(model.playlists, 'find', {id: aed.playlist_id}).get(0).get(0).then(function(playlist){
                        aed.playlist = playlist;
                        delete aed.playlist_id;
                    });
                }));
            });
        }
        
        if(options.showThumbnail){
            postprocess.push(function(aeds){
                aeds.forEach(function(aed){
                    aed.thumbnail = 'https://' + config('aws').bucketName + '.s3.amazonaws.com/aed/' + aed.id + '.png';
                });
            });
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


    independentStatisticParams: [
        {   statistic: "area",
            title: "Area",
            units: "Hz s",
            select:'RAE.area', range:{min:0}
        },
        {   statistic: "bw",
            title: "Bandwidth",
            units: "Hz",
            select:'RAE.bw', range:{min:0}
        },
        {   statistic: "cov",
            title: "% Coverage",
            units: "%",
            select:'RAE.coverage', range:{min:0, max:1}
        },
        {   statistic: "dur",
            title: "Duration",
            units: "s",
            select:'RAE.dur', range:{min:0}
        },
        {   statistic: "tod",
            title: "Time of Day",
            units: "h",
            select:'HOUR(R.datetime)', 
            table:'JOIN recordings R ON R.recording_id = RAE.recording_id', 
            range:{min:0, max:23}, 
            maxBins:24
        
        },
        {   statistic: "todsec",
            title: "Time of Day (w/seconds)",
            select:'HOUR(R.datetime) * 60 + RAE.t0', 
            table:'JOIN recordings R ON R.recording_id = RAE.recording_id', 
            range:{min:0, max:(24 * 60) - 1}, 
            units: "h",
            defBins: 24 * 60,
            maxBins: 24 * 60
            
        },
        {   statistic: "todsecspan",
            title: "Time of Day (w/seconds, event time spans)",
            select:[
                'HOUR(R.datetime) * 60 + RAE.t0',
                'HOUR(R.datetime) * 60 + RAE.t1'
            ], 
            table:'JOIN recordings R ON R.recording_id = RAE.recording_id', 
            range:{min:0, max:(24 * 60) - 1}, 
            units: "h",
            defBins: 24 * 60,
            maxBins: 24 * 60
            
        },
        {   statistic: "y_max",
            title: "Dominant Frequency",
            units: "Hz",
            select:'RAE.max_y', range:{min:0}
        },
        {   statistic: "freqspan",
            title: "Frequency Spans",
            units: "Hz",
            select:['RAE.f0', 'RAE.f1'], range:{min:0}
        },
    ].reduce(function(_, $){
        return _.list.push($), _.index[$.statistic]=$, _;
    }, {list:[], index:{}}),
    
    dependentStatisticParams: [
        {   statistic: "count",
            title: "# Events",
            select:"COUNT(*)"
        },
        {   statistic: "log count",
            title: "Log # Events",
            select:"LOG(COUNT(*) + 1)", 
            fn:function(x){
                return Math.log(x + 1);
            }
        },
        {   statistic: "recordings",
            title: "Log # Recordings",
            select:"COUNT(DISTINCT RAE.recording_id)"
        }
    ].reduce(function(_, $){
        return _.list.push($), _.index[$.statistic]=$, _;
    }, {list:[], index:{}}),
    
    getDataStatistics: function(){
        return AudioEventDetections.independentStatisticParams.list.map(function(idp){
            return {title:idp.title, statistic:idp.statistic, units:idp.units};
        });
    },
    
    getDataAggregates: function(){
        return AudioEventDetections.dependentStatisticParams.list.map(function(dp){
            return {title:dp.title, statistic:dp.statistic};
        });
    },


    /** Fetches data related to the given aed.
     * @param {Object} params - parameter object.
     * @param {Integer} params.aed_id - id of aed to query for data
     * @param {String} params.x - x variable from aed statistics
     * @param {String} params.y - y variable from aed statistics
     * @param {String} params.z - summary statistic use to show the data (Count, etc.)
     * @return {Promise} resolving to the queried data.
     */
    getData: function(params){
        params = params || {};
        var aed_id = params.aed;
        var x = params.x;
        var y = params.y;
        var z = ('' + params.z).toLowerCase();
        var bins = {
            x : params.binsx || params.bins,
            y : params.binsy || params.bins,
        };
        var prepSteps = [], postSteps = [];

        
        var dependentStatistic = AudioEventDetections.dependentStatisticParams.index[z] || 
            AudioEventDetections.dependentStatisticParams.index.count;
        
        var axes = [{name:"x", statistic:x, params:AudioEventDetections.independentStatisticParams.index[x]}];
        if(x != y){
            axes.push({name:"y", statistic:y, params:AudioEventDetections.independentStatisticParams.index[y]});
        }        
        
        var select = [], tables = [
            "recording_audio_events RAE"
        ], groupby=[];
        
        var data = {
            aed : aed_id,
            axes: axes.map(function($){ return $.name; }),
            value: 'z',
            rows : null
        };
        
        var isPunctualData = true;
        
        axes.forEach(function(axis){
            if(axis.params.table && tables.indexOf(axis.params.table) == -1){
                tables.push(axis.params.table);
            }
            
            var axisBins = Math.min(+bins[axis.name] || axis.params.defBins || 100, axis.params.maxBins || 200);
            var axisData;
            console.log(axisBins, +bins[axis.name], axis.params.defBins, Infinity, axis.name, axis.params.maxBins);
            
            prepSteps.push(
                (
                    (axis.range && ("max" in axis.range) && ("min" in axis.range)) ? 
                    q.resolve(axis.range) : 
                    AudioEventDetections.getDataRange({
                        aed:aed_id, 
                        statistic:axis.statistic
                    })
                ).then(function(range){
                    axisData = data[axis.name] = {
                        statistic: axis.statistic, 
                        min: +range.min,
                        max: +range.max,
                        step: (range.max - range.min) / ((axisBins - 1) || 1),
                        bins : axisBins
                    };
                }).then(function(){
                    if(axis.params.select instanceof Array){
                        isPunctualData = false;
                        axis.params.select.forEach(function(axis_select, i){
                            var name = axis.name + "_" + i;
                            select.push(
                                "FLOOR(" + 
                                "((" + axis_select + ") - " + axisData.min + ") / " + 
                                axisData.step + 
                                ") AS " + name
                            );
                            groupby.push(name);
                        });
                    } else {
                        select.push(
                            "FLOOR(" + 
                            "((" + axis.params.select + ") - " + axisData.min + ") / " + 
                            axisData.step + 
                            ") AS " + axis.name
                        );
                        
                        groupby.push(axis.name);
                    }
                })
            );
        });
        
        if(dependentStatistic.preProcess){
            prepSteps = [q.all(prepSteps).then(function(){
                return dependentStatistic.preProcess(data, select, tables, groupby);
            })];
        }
        
        if(dependentStatistic.select){
            select.push("(" + dependentStatistic.select + ") AS z");
        }
        
        if(dependentStatistic.postProcess){
            postSteps.push(dependentStatistic.postProcess);
        }

        return q.all(prepSteps).then(function(){
            return dbpool.query("SELECT " + select.join(", ") + "\n" +
                "FROM " + tables.join("\n") + "\n" +
                "WHERE RAE.aed_id = ?\n" + 
                "GROUP BY " + groupby.join(", "), [
                aed_id
            ]).then(function(rows){
                if(isPunctualData || params.rows){
                    data.rows = rows;
                } else {
                    data.matrix = generateDataMatrix(
                        (data.y || {bins:1}).bins, 
                        data.x.bins, 
                        rows,
                        dependentStatistic
                    );
                }
            }).then(function(){
                return data;
            });
        });
        
    },
    
    /** Fetches the range of the data related to the given aed for a given statistic.
    * @param {Object} params - parameter object.
    * @param {Integer} params.aed_id - id of aed to query for data
    * @param {String} params.statistic - statistic being queried
     * @return {Promise} resolving to the range of the given data's statistics.
     */
     getDataRange: function(params){
         params = params || {};
         var aed_id = params.aed;
         var statistic = AudioEventDetections.independentStatisticParams.index[params.statistic];

         var select = statistic.select;
         var tables = [
             "recording_audio_events RAE"
         ];
         if(statistic.table){
             tables.push(statistic.table);
         }   
               
         return dbpool.query(
             "SELECT MIN(" + (select instanceof Array ? ("LEAST(" + select.join(", ") + ")") : select) + ") as `min`, \n"+
             "       MAX(" + (select instanceof Array ? ("GREATEST(" + select.join(", ") + ")") : select) + ") as `max` \n" +
             "FROM " + tables.join("\n") + "\n" +
             "WHERE RAE.aed_id = ?", [
             aed_id
         ]).get(0);
    },
    
    setDefaultPlot: function(params){
        var aed = params.aed | 0;
        var plotkey = 'aed/' + aed + '.png';
        var plotfilename = tmpfilecache.key2File(plotkey);
        var data={};
        return AudioEventDetections.getData(params).then(function(data){
            return offlinePlotter.plot(data, plotfilename);
        }).then(function(){
            if(!s3){
                s3 = new AWS.S3();
            }
            return q.ninvoke(s3, 'putObject', {
                Bucket : config('aws').bucketName,
                Key    : plotkey,
                ACL: 'public-read',
                Body: fs.createReadStream(plotfilename),
            }).then(function(){
                return 'https://' + config('aws').bucketName + '.s3.amazonaws.com/' + encodeURI(plotkey);
            });
            
        });
    },
    
    
    /** Sets the AED's default plot. */

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
