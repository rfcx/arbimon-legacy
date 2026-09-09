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
    getTagsFor : function(resource, id, projectId){
        var resourceDef = this.resourceDefs[resource];
        if(!resourceDef){
            return q.reject(new APIError(resource + " resources do not support tags.", 415));
        }

        // 2026-09-09 (OPEN-ITEMS §292): projectId is forwarded so the resource
        // def can bind the id to the project in the URL.
        return resourceDef.getFor(id, projectId);
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
    removeTagFrom: function(resource, id, resourceTagId, projectId){
        var resourceDef = this.resourceDefs[resource];
        if(!resourceDef){
            return q.reject(new APIError(resource + " resources do not support tags.", 415));
        }

        // 2026-09-09 (OPEN-ITEMS §292): forward projectId, as above.
        return resourceDef.removeFrom(id, resourceTagId, projectId);
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
    getFor: async function(id, projectId){
        // 2026-09-09 (rfcx-local, OPEN-ITEMS §292): scope by project.
        // The route authorised the project in the URL and then passed a bare
        // recording id, so any logged-in user could read another project's
        // recording tags by id. `recording_tags` carries `site_id`, and
        // `getForType` right below already scopes that way via
        // `projects.getProjectSites` -- reuse the same shape rather than
        // hand-rolling a join.
        if (projectId === undefined || projectId === null) {
            throw new Error('tags.recording.getFor requires projectId');
        }
        const sites = await projects.getProjectSites(projectId);
        if (!sites || !sites.length) return [];
        // 2026-09-09 (rfcx-local, IRR on OPEN-ITEMS §292): also honour the
        // ARCHIVE scope. `getForType` below applies
        // `recordingArchiveScope('r','active')` -- Phase A "hide-by-parent" --
        // so the project-wide tag view deliberately hides tags on archived
        // recordings. This per-recording read scoped by site only and never
        // joined `recordings`, so it could still surface them: the two views
        // disagreed about the same rows.
        //
        // Not hypothetical since the L1 retro-archive (2026-09-08): 32,473
        // recordings are archived, of which 4 carry tags (projects 7890 and
        // 8937). Small today and growing as Phase B archives more.
        return q.ninvoke(dbpool, 'queryHandler',
            // 2026-09-09 (rfcx-local): every projected column is QUALIFIED.
            // The archive-scope commit added `JOIN recordings r`, and
            // `recordings` also has a `datetime` column -- so the previously
            // unqualified `datetime`, `user_id`, `t0/f0/t1/f1` became
            // ambiguous and the route 500'd on BOTH engines
            // (MariaDB ER_NON_UNIQ_ERROR / PG 42702 "column reference
            // \"datetime\" is ambiguous"). Qualifying them is the minimal fix
            // and keeps the response shape byte-identical.
            "SELECT RT.recording_tag_id as id, T.tag_id, T.tag, RT.user_id, RT.datetime, RT.t0, RT.f0, RT.t1, RT.f1\n" +
            "FROM recording_tags RT\n" +
            "JOIN tags T ON RT.tag_id = T.tag_id\n" +
            "JOIN recordings r ON r.recording_id = RT.recording_id\n" +
            "WHERE RT.recording_id = ?\n" +
            "AND " + require('../utils/sqlutil').recordingArchiveScope('r', 'active') + "\n" +
            "AND RT.site_id IN (" + dbpool.escape(sites.map(s => s.id)) + ")", [id]
        ).get(0);
    },
    /** Fetches the tags for a given resource.type
     *  @param {String} options - options delimiting what tags to fetch.
     *  @param {String} options.project - limit tags to resources in the given project.
     *  @returns {Promise} Promise resolving to fetched tags.
     */
    getForType: async function(options){
        var tables = ['tags T', 'JOIN recording_tags RT ON RT.tag_id = T.tag_id', 'JOIN recordings r ON r.recording_id = RT.recording_id'];
        var constraints = [];
        // Archiving (Phase A): exclude tags on archived recordings from the
        // project-wide tag counts (hide-by-parent).
        constraints.push(require('../utils/sqlutil').recordingArchiveScope('r', 'active'));

        if(options && options.project){
            const sites = await projects.getProjectSites(options.project)
            if (sites && sites.length) {
                constraints.push('RT.site_id IN (' + dbpool.escape(sites.map(s => s.id)) + ')');
            } else return []
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

        // Captured so the created-row echo below never has to be read back.
        var tagId = null;
        var tagText = tag.text;
        var insertedAt = null;

        var tagIdPromise = tag.id ? q(tag.id) : q.ninvoke(dbpool, 'queryHandler',
            "INSERT IGNORE INTO tags(tag) VALUES (?)", [tag.text]
        ).then(function(result){
            return result[0].insertId;
        }).catch(function(){
            return q.ninvoke(dbpool, 'queryHandler',
                "SELECT tag_id FROM tags WHERE tag = ?", [tag.text]
            ).get(0).get(0);
        });

        return tagIdPromise.then(async function(_tagId){
            tagId = _tagId;
            // When the caller passed tag.id we never learned the tag TEXT.
            // Resolve it BEFORE the INSERT: the tags row is pre-existing, so
            // this is not a read-after-write and is safe on either engine.
            if (tagText === undefined || tagText === null) {
                var trows = await q.ninvoke(dbpool, 'queryHandler',
                    "SELECT tag FROM tags WHERE tag_id = ?", [tagId]
                ).get(0);
                tagText = (trows && trows[0]) ? trows[0].tag : null;
            }
            insertedAt = new Date();
            return q.ninvoke(dbpool, 'queryHandler',
                "INSERT INTO recording_tags(recording_id, site_id, tag_id, user_id, datetime, t0, f0, t1, f1)\n"+
                "VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?)", [
                    recording.recording_id, recording.site_id, tagId, userId,
                    tag.t0 || null, tag.f0 || null,
                    tag.t1 || null, tag.f1 || null
                ]
            ).get(0);
        }).then(function(results){
            // READ-AFTER-WRITE REMOVED (2026-08-08) -- same class as
            // training_sets.add_data (#1795). This SELECT is classified
            // {replayable:true} by the deployed adapter, so at DB_ENGINE=pg it
            // is served from PostgreSQL while the INSERT above still goes to
            // MariaDB (legacy owns writes until Phase 7). The row reaches PG
            // only on the next forward delta-sync tick (*/2 min), so a re-read
            // microseconds later finds NOTHING every time, and the route would
            // hand the UI `undefined` as the newly created tag.
            //
            // Reconstructed locally instead. Verified against the live schema:
            // recording_tags has NO triggers and its ONLY defaulted column is
            // the auto-increment pk; every other projected column is supplied
            // by the INSERT above.
            if (!results || results.insertId === undefined || results.insertId === null) {
                return q.reject(new APIError('Failed to create recording tag'));
            }
            return {
                id       : results.insertId,
                tag_id   : tagId,
                tag      : tagText,
                user_id  : userId,
                // NOW() was evaluated server-side by MariaDB. `insertedAt` is
                // captured immediately before the INSERT (sub-second accurate)
                // and is used only for this immediate UI echo; the durable
                // value stored in the row remains MariaDB's NOW().
                datetime : insertedAt,
                t0 : tag.t0 || null, f0 : tag.f0 || null,
                t1 : tag.t1 || null, f1 : tag.f1 || null
            };
        });
    },
    /** Removes a tag from a given recording.
     *  @param {String} resource - type of the recording to remove the tag from.
     *  @param {String} id - the id of the recording to remove the tag from.
     *  @param {Number} recordingTagId - id of recording tag entry to be removed from the recording.
     *  @returns {Promise} Promise resolving to the count of removed tags.
     */
    removeFrom: async function(id, recordingTagId, projectId){
        // 2026-09-09 (rfcx-local, OPEN-ITEMS §292): scope the DELETE by project.
        // Same defect as getFor above, on the destructive side: the route
        // checked `manage project recordings` on the URL's project and then
        // deleted by bare recording id. Scoping the DELETE itself means the
        // guarantee survives a future caller that forgets the route guard --
        // the lesson from §291, where a third bare-id call site was found only
        // by enumerating callers.
        if (projectId === undefined || projectId === null) {
            throw new Error('tags.recording.removeFrom requires projectId');
        }
        const sites = await projects.getProjectSites(projectId);
        if (!sites || !sites.length) return [];
        return q.ninvoke(dbpool, 'queryHandler',
            "DELETE FROM recording_tags\n" +
            "WHERE recording_id = ? AND recording_tag_id = ?\n" +
            "AND site_id IN (" + dbpool.escape(sites.map(s => s.id)) + ")", [id, recordingTagId]
        ).get(0);
    },
};


module.exports = tags;
