var q = require('q');
var joi = require('joi');
var projects = require('./projects');
var dbpool = require('../utils/dbpool');
var APIError = require('../utils/apierror');

/** Soundscape composition model.
 *  Holds all functions for manipulating classes in use for the soundscape composition tool.
 * @namespace
 */
var SoundscapeComposition = {
    getClassesFor:function(options){
        options = options || {};
        var select=["SCC.id, SCC.name, SCC.isSystemClass as `system`, SCC.typeId, SCCT.type"];
        var tables = [
            "soundscape_composition_classes SCC",
            "JOIN soundscape_composition_class_types SCCT ON SCC.typeId = SCCT.id",
        ], where = [], data = [], order = ["SCC.typeId, SCC.isSystemClass DESC"];
        var selectdata=[];
        var presteps = [];

        if(options.tally){
            if(options.project){
                presteps.push(projects.getProjectSites(options.project).then(function(sites){
                    if(sites.length){
                        select.push("(" +
                        "SELECT COUNT(*) " +
                        "FROM recording_soundscape_composition_annotations RSCA " +
                        "JOIN recordings R ON R.recording_id = RSCA.recordingId " +
                        "WHERE RSCA.scclassId = SCC.id " +
                        "AND R.site_id IN (?)" +
                        ") as tally");
                        selectdata.push(sites.map(function(site){
                            return site.id;
                        }));
                    } else {
                        select.push("0 as tally");
                    }
                }));
            } else {
                select.push("(" +
                    "SELECT COUNT(*) " +
                    "FROM recording_soundscape_composition_annotations RSCA " +
                    "WHERE RSCA.scclassId = SCC.id" +
                ") as tally");
            }
        }

        if(options.project && !options.isSystemClass){
            tables.push("JOIN project_soundscape_composition_classes PSCC ON PSCC.scclassId = SCC.id");
            where.push("PSCC.projectId = ?");
            data.push(options.project);
            order.push("PSCC.`order`");
        }

        if (options.isSystemClass) {
            where.push("SCC.isSystemClass");
        }

        if(options.id){
            where.push("SCC.id IN (?)");
            data.push(options.id);
        }

        return q.all(presteps).then(function(){
            data.unshift.apply(data, selectdata);
            return dbpool.query(
                "SELECT " + select.join(", ") + "\n" +
                "FROM " + tables.join("\n") + "\n" +
                (where.length ? "WHERE (" + where.join(")\n AND (") + ")\n" : "") +
                "ORDER BY " + order.join(", "),
                data
            );
        });
    },

    addClass: function(name, type, project){
        var scClass;
        return dbpool.query(
            "SELECT SCC.id\n"+
            "FROM soundscape_composition_classes SCC\n"+
            "WHERE SCC.name=?", [
                name
        ]).get(0).then(function(foundClass){
            if(foundClass){
                return foundClass.id;
            } else {
                return dbpool.query(
                    "INSERT INTO soundscape_composition_classes(typeId, name, isSystemClass)\n"+
                    "VALUES (?, ?, 0)",[
                    type, name
                ]).get('insertId');
            }
        }).then(function(scClassId){
            return SoundscapeComposition.getClassesFor({id:scClassId}).get(0);
        }).then(function(_scClass){
            scClass = _scClass;
            console.log("scClass", scClass);
        }).then(function(){
            if(!scClass.isSystemClass){
                return dbpool.query(
                    "INSERT INTO project_soundscape_composition_classes(projectId, scclassId, `order`)\n"+
                    "VALUES (?, ?, ?)",[
                        project, scClass.id, 0
                    ]).catch(function(err){
                        if(err.code == 'ER_DUP_ENTRY'){
                            throw new APIError("Soundscape composition class already in project.");
                        } else {
                            throw err;
                        }
                    });
            }
        }).then(function(_scClass){
            return scClass;
        });
    },

    removeClassFrom: function(scClassId, project){
        return dbpool.query(
            "DELETE FROM project_soundscape_composition_classes\n"+
            "WHERE projectId = ? AND scclassId = ?",[
                project, scClassId
            ]);
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
