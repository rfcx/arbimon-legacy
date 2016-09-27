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
    makeHash: function(data){
        var salt = Math.ceil(new Date().getTime() / 1000).toString();
        return sha256(salt + JSON.stringify([
            (data.processing | 0),
            (data.recordings | 0),
            (data.user | 0),
            (data.project | 0),
        ]) + Math.random(), 'base64').replace(/\//g,'-').replace(/=+$/,'');
    },
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
