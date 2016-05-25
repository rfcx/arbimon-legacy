var q = require('q');
var joi = require('joi');
var mysql = require('mysql');
var dbpool = require('../utils/dbpool');
var APIError = require('../utils/apierror');

/** Soundscape composition model.
 *  Holds all functions for manipulating classes in use for the soundscape composition tool.
 * @namespace
 */
var SoundscapeComposition = {
    getClassesFor:function(options){
        options = options || {};
        var select=["SCC.id, SCC.name, SCC.isSystemClass as system, SCC.typeId, SCCT.type"];
        var tables = [
            "soundscape_composition_classes SCC",
            "JOIN soundscape_composition_class_types SCCT ON SCC.typeId = SCCT.id",
        ], where = [], data = [], order = ["SCC.typeId, SCC.isSystemClass"];
        
        if(options.tally){
            select.push("(SELECT COUNT(*) FROM recording_soundscape_composition_annotations RSCA WHERE RSCA.scclassId = SCC.id) as tally");
        }
        
        if(options.project){
            tables.push("LEFT JOIN project_soundscape_composition_classes PSCC ON PSCC.scclassId = SCC.id");
            where.push("PSCC.projectId = ? OR (PSCC.projectId IS NULL AND SCC.isSystemClass)");
            data.push(options.project);
            order.push("PSCC.`order`");
        }

        if(options.id){
            where.push("SCC.id IN (?)");
            data.push(options.id);
        }
        
        return dbpool.query(
            "SELECT " + select.join(", ") + "\n" +
            "FROM " + tables.join("\n") + "\n" +
            (where.length ? "WHERE (" + where.join(")\n AND (") + ")\n" : "") +
            "ORDER BY " + order.join(", "),
            data
        );
    },
    
    getAnnotationsFor: function(options){
        options = options || {};
        return dbpool.query(
            "SELECT RSCA.scclassId, RSCA.present\n" +
            "FROM recording_soundscape_composition_annotations RSCA\n" +
            "WHERE RSCA.recordingId = ?\n", [
            options.recording
        ]).then(function(annotations){
            if(options.groupResults){
                return annotations.reduce(function(_, annotation){
                    _[annotation.scclassId] = annotation.present;
                    return _;
                }, {});
            } else {
                return annotations;
            }
        });
    },
    
    annotateSchema : joi.object().keys({
        recording: joi.number(),
        annotation: joi.object().keys({
            class: joi.string(),
            val: joi.number()
        })
    }),

    /** Annotates a recording.
     * @param {Object} options - the options object.
     * @param {Integer} options.recording - id of the recording to associate to this annotation.
     * @param {Object}  options.annotation - object containing the annotation to add to this recording.
     * @param {String}  options.annotation.class - comma separated list of ids. ej: '7,3'
     * @param {Integer} options.annotation.val   - value used to annotate the class in the given recording.
     * @return {Promise} resolved after adding the annotations.
     */
    annotate: function (options) {
        return q.ninvoke(joi, 'validate', options, SoundscapeComposition.annotateSchema).then(function(){
            return q.all(options.annotation.class.split(',').map(function(scclassId){
                var annotation = {
                    recordingId : options.recording,
                    scclassId   : scclassId,
                    present     : options.annotation.val | 0
                };

                if (annotation.present < 0 || annotation.present > 2) {
                    return q.reject(new Error("Invalid annotation value " + annotation.present));
                }
                
                // 0 is not present , 1 is present and 2 is clear
                return ((annotation.present == 2) ?
                    dbpool.query(
                        "DELETE FROM `recording_soundscape_composition_annotations`\n"+
                        " WHERE `recordingId` = ? AND `scclassId` = ?\n", [
                        annotation.recordingId,
                        scclassId
                    ]) :
                    dbpool.query(
                        "INSERT INTO recording_soundscape_composition_annotations(recordingId, scclassId, present)\n" +
                        " VALUES (?, ?, ?) \n" +
                        " ON DUPLICATE KEY UPDATE present = VALUES(present)", [
                        annotation.recordingId, annotation.scclassId, annotation.present
                    ])
                ).then(function(){
                    return annotation;
                });
            }));
        });
    },


};


module.exports = SoundscapeComposition;