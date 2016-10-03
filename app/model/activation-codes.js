/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:model:activation-codes');
var util = require('util');
var joi = require('joi');
var q = require('q');
var dbpool = require('../utils/dbpool');
var sha256 = require('../utils/sha256');

var ActivationCodes = {
    /** Return list of ActivationCodes.
     * @param {Object} options - options.
     * @param {Object} options.hash - match by hash.
     * @param {Object} options.consumer - match usable by user.
     * @param {Object} options.project - match usable for project.
     *
     * @return {Promise} resolving to a list of the queries activation codes.
     */
    listAll: function(options) {
        options = options || {};
        var where = [], data = [];
        
        if(options.hash){
            where.push('hash = ?');
            data.push(options.hash);
        }
        
        if(options.hasOwnProperty('consumed')){
            where.push('consumed = ?');
            data.push(options.consumed);
        }
        
        if(options.consumer){
            where.push(options.strict ? 'consumer = ?' : 'consumer = ? OR consumer IS NULL');
            data.push(options.consumer);
        }
        
        if(options.project){
            where.push(options.strict ? 'project = ?' : 'project = ? OR project IS NULL');
            data.push(options.project);
        }
        
        return dbpool.query(
            "SELECT activation_code_id as id, hash, created, creator, payload, consumed, consumer, project\n"+
            "FROM activation_codes" + 
            (where.length ? "\nWHERE (" + where.join(")\n AND (") + ")" : ""),
            data
        ).then(function(data){
            return data.map(function(item){
                item.payload = JSON.parse(item.payload);
                return item;
            });
        });
    },
    /** Returns a hash of the given data.
     * @param {Object} data - data object.
     * @param {Integer} data.processing - associated ammount of processing.
     * @param {Integer} data.recordings - associated ammount of recordings.
     * @param {Integer} data.user - associated user.
     * @param {Integer} data.project - associated project.
     8 @return {String} hash based on the given data parameters.
     */
    makeHash: function(data){
        var salt = Math.ceil(new Date().getTime() / 1000).toString();
        return sha256(salt + JSON.stringify([
            (data.processing | 0),
            (data.recordings | 0),
            (data.user | 0),
            (data.project | 0),
        ]) + Math.random(), 'base64').replace(/\//g,'-').replace(/=+$/,'');
    },
    /** Creates an activation code for the given creator and data.
     * @param {Object} creator - user who created the code.
     * @param {Object} data - data payload for the access code.
     * @param {Integer} data.processing - associated ammount of processing.
     * @param {Integer} data.recordings - associated ammount of recordings.
     * @param {Integer} data.user - associated user. (optional)
     * @param {Integer} data.project - associated project. (optional)
     *
     * @return {Promise} resolving to the created access code.
     */
    createCode: function(creator, data){
        var hash = this.makeHash(data);
        return dbpool.query(
            "INSERT INTO activation_codes(hash, created, creator, payload, consumed, consumer, project)\n"+
            "VALUES (?, NOW(), ?, ?, 0, ?, ?)", [
                hash, creator.id, JSON.stringify({
                    processing : (data.processing | 0),
                    recordings : (data.recordings | 0),
                    duration : (data.duration | 0),
                }),
                (data.user | 0) || null,
                (data.project | 0) || null,
            ]
        );
    },
    /** Consumes an activation code.
     * @param {Object} code - access code.
     * @param {Integer} code.id - code id
     * @param {Integer} consumer - consumer id
     *
     * @return {Promise} resolving after consuming the code.
     */
     consumeCode: function(code, consumer){
        return dbpool.query(
            "UPDATE activation_codes\n"+
            "SET consumed=1, consumer=?\n"+
            "WHERE activation_code_id=?", [
                consumer, code.id
            ]
        );
    },
};


module.exports = ActivationCodes;
