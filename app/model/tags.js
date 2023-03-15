"use strict";
const q = require('q');
const dbpool = require('../utils/dbpool');
const APIError = require('../utils/apierror');
const projects = require('./projects');

/** Tags model.
 *  Holds all functions for manipulating tags.
 * @namespace
 */
var tags = {
    /** Tagged resource definitions.
     *  Hold all the resource-specific tagging functions.
     * @type {Object}
     */
    resourceDefs:{},
    /** Fetches the tags for a given resource.
     *  @param {String} resource - the type of resource whose tags to fetch.
     *  @param {String} id - the id of the resource whose tags to fetch.
     *  @returns {Promise} Promise resolving to fetched tags, or rejecting if the
     *     resource type does not support tags or any error occurred.
     */
    getTagsFor : function(resource, id){
        var resourceDef = this.resourceDefs[resource];
        if(!resourceDef){
            return q.reject(new APIError(resource + " resources do not support tags.", 415));
        }

        return resourceDef.getFor(id);
    },
    /** Fetches the tags for a given resource.type
     *  @param {String} resource - the type of resource whose tags to fetch.
     *  @param {String} options - options delimiting what tags to fetch.
     *  @param {String} options.project - limit tags to resources in the given project.
     *  @returns {Promise} Promise resolving to fetched tags, or rejecting if the
     *     resource type does not support tags or any error occurred.
     */
    getTagsForType : function(resource, options){
        var resourceDef = this.resourceDefs[resource];
        if(!resourceDef){
            return q.reject(new APIError(resource + " resources do not support tags.", 415));
        }

        return resourceDef.getForType(options);
    },
    /** Adds a tag to a given resource.
     *  @param {String} resource - type of the resource to add the tag to.
     *  @param {Object} recording - original recording object.
     *  @param {String} tag - tag to be added to the resource.
     *  @param {Number} tag.id - tag is referenced by the given id.
     *  @param {String} tag.text - tag is to be created with the given text.
     *  @param {Object} tag.user - user adding the tag.
     *  @param {Any} tag.* - resource-specific tag data.
     *  @returns {Promise} Promise resolving to fetched tags, or rejecting if the
     *     resource type does not support tags or any error occurred.
     */
    addTagTo: function(resource, recording, tag) {
        var resourceDef = this.resourceDefs[resource];
        if(!resourceDef){
            return q.reject(new APIError(resource + " resources do not support tags.", 415));
        }

        return resourceDef.addTo(recording, tag);
    },
    /** Removes a tag from a given resource.
     *  @param {String} resource - type of the resource to remove the tag from.
     *  @param {String} id - the id of the resource to remove the tag from.
     *  @param {Number} resourceTagId - id of resource tag entry to be removed from the resource.
     *  @returns {Promise} Promise resolving to fetched tags, or rejecting if the
     *     resource type does not support tags or any error occurred.
     */
    removeTagFrom: function(resource, id, resourceTagId){
        var resourceDef = this.resourceDefs[resource];
        if(!resourceDef){
            return q.reject(new APIError(resource + " resources do not support tags.", 415));
        }

        return resourceDef.removeFrom(id, resourceTagId);
    },

    /** Searches for tags matching the given query.
     *  @param {Object} options - options object.
     *  @param {Object} options.id - tag ids to match
     *  @returns {Promise} Promise resolving to matching tags, or rejecting if
     *     any error occurred.
     */
    getFor: function(options){
        options = options || {};
        var where = [], data = [];

        if(options.id){
            where.push("T.tag_id IN (?)");
            data.push(options.id);
        }

        return q.ninvoke(dbpool, 'queryHandler',
            "SELECT T.tag_id, T.tag, 'tag' as type\n" +
            "FROM tags T\n" +
            (where.length ? "WHERE (" + where.join(") AND (") + ")" : ""),
            data
        ).get(0);
    },

    /** Searches for tags matching the given query.
     *  @param {Object} query - query object.
     *  @param {Object} query.q - text to match.
     *  @param {Object} query.offset - offset of results.
     *  @param {Object} query.limit - limit count of results. (maximum is 20)
     *  @returns {Promise} Promise resolving to matching tags, or rejecting if
     *     any error occurred.
     */
    search: function(query){
        var txt = '%' + (query.q || '') + '%';
        var offset = Math.max(query.offset|0, 0);
        var limit = Math.min(Math.max(0, (query.limit|0) || 20), 20);
        return q.ninvoke(dbpool, 'queryHandler',
            "SELECT T.tag_id, T.tag, 'tag' as type\n" +
            "FROM tags T\n" +
            "WHERE T.tag LIKE ?\n"+
            "ORDER BY T.tag\n" +
            "LIMIT ? OFFSET ?", [txt, limit, offset]
        ).get(0);
    }
};

/** Recording tag resource definition.
 *  Holds all functions for manipulating recording tags.
 * @namespace
 */
tags.resourceDefs.recording = {
    /** Fetches the tags for a given recording.
     *  @param {String} id - the id of the recording whose tags to fetch.
     *  @returns {Promise} Promise resolving to fetched tags.
     */
    getFor: function(id){
        return q.ninvoke(dbpool, 'queryHandler',
            "SELECT RT.recording_tag_id as id, T.tag_id, T.tag, user_id, datetime, t0, f0, t1, f1\n" +
            "FROM recording_tags RT\n" +
            "JOIN tags T ON RT.tag_id = T.tag_id\n" +
            "WHERE RT.recording_id = ?", [id]
        ).get(0);
    },
    /** Fetches the tags for a given resource.type
     *  @param {String} options - options delimiting what tags to fetch.
     *  @param {String} options.project - limit tags to resources in the given project.
     *  @returns {Promise} Promise resolving to fetched tags.
     */
    getForType: async function(options){
        var tables = ['tags T', 'JOIN recording_tags RT ON RT.tag_id = T.tag_id'];
        var constraints = [];

        if(options && options.project){
            const sites = await projects.getProjectSites(options.project)
            if (sites && sites.length) {
                constraints.push('RT.site_id IN (' + dbpool.escape(sites.map(s => s.id)) + ')');
            }
        }
        return q.ninvoke(dbpool, 'queryHandler',
            "SELECT T.tag_id, T.tag, COUNT(*) as count\n" +
            "FROM " + tables.join("\n") + "\n" +
            (constraints.length ? ("WHERE " + constraints.join(' AND ') + "\n") : "") +
            'GROUP BY T.tag_id',
            []
        ).get(0);
    },
    /** Adds a tag to a given recording.
     *  @param {String} id - the id of the recording to add the tag to.
     *  @param {String} tag - tag to be added to the recording.
     *  @param {Number} tag.id - tag is referenced by the given id.
     *  @param {String} tag.text - tag is to be created with the given text.
     *  @param {Object} tag.user - user adding the tag.
     *  @param {Any} tag.* - recording-specific tag data.
     *  @returns {Promise} Promise resolving to added tags.
     */
    addTo: function(recording, tag){
        var userId = tag.user && tag.user.id;
        if(!tag.id && !tag.text){
            return q.reject(new APIError('No tag id or text given'));
        } else if(!userId){
            return q.reject(new APIError('No user specified'));
        }

        var tagIdPromise = tag.id ? q(tag.id) : q.ninvoke(dbpool, 'queryHandler',
            "INSERT IGNORE INTO tags(tag) VALUES (?)", [tag.text]
        ).then(function(result){
            return result[0].insertId;
        }).catch(function(){
            return q.ninvoke(dbpool, 'queryHandler',
                "SELECT tag_id FROM tags WHERE tag = ?", [tag.text]
            ).get(0).get(0);
        });

        return tagIdPromise.then(async function(tagId){
            return q.ninvoke(dbpool, 'queryHandler',
                "INSERT INTO recording_tags(recording_id, site_id, tag_id, user_id, datetime, t0, f0, t1, f1)\n"+
                "VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?)", [
                    recording.recording_id, recording.site_id, tagId, userId,
                    tag.t0 || null, tag.f0 || null,
                    tag.t1 || null, tag.f1 || null
                ]
            ).get(0);
        }).then(function(results){
            return q.ninvoke(dbpool, 'queryHandler',
                "SELECT RT.recording_tag_id as id, T.tag_id, T.tag, user_id, datetime, t0, f0, t1, f1\n" +
                "FROM recording_tags RT\n" +
                "JOIN tags T ON RT.tag_id = T.tag_id\n" +
                "WHERE RT.recording_tag_id = ?", [results.insertId]
            ).get(0);
        });
    },
    /** Removes a tag from a given recording.
     *  @param {String} resource - type of the recording to remove the tag from.
     *  @param {String} id - the id of the recording to remove the tag from.
     *  @param {Number} recordingTagId - id of recording tag entry to be removed from the recording.
     *  @returns {Promise} Promise resolving to the count of removed tags.
     */
    removeFrom: function(id, recordingTagId){
        return q.ninvoke(dbpool, 'queryHandler',
            "DELETE FROM recording_tags\n" +
            "WHERE recording_id = ? AND recording_tag_id = ?", [id, recordingTagId]
        ).get(0);
    },
};


module.exports = tags;
