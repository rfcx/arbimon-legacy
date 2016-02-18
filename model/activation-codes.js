/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:model:activation-codes');
var util = require('util');
var mysql = require('mysql');
var joi = require('joi');
var q = require('q');
var db = require('../utils/dbpool');
var sha256 = require('../utils/sha256');

var ActivationCodes = {
    listAll: function(callback) {
        return db.query(
            "SELECT activation_code_id as id, hash, created, creator, payload, consumed, consumer, project\n"+
            "FROM activation_codes"
        ).then(function(data){
            return data.map(function(item){
                item.payload = JSON.parse(item.payload);
                return item;
            });
        });
    },
    createCode: function(creator, data){
        var salt = Math.ceil(new Date().getTime() / 1000).toString();
        var hash = sha256(salt + JSON.stringify([
            (data.processing | 0),
            (data.recordings | 0),
            (data.user | 0),
            (data.project | 0),
        ]) + Math.random());
        return db.query(
            "INSERT INTO activation_codes(hash, created, creator, payload, consumed, consumer, project)\n"+
            "VALUES (?, NOW(), ?, ?, 0, ?, ?)", [
                hash, creator.id, JSON.stringify({
                    processing : (data.processing | 0),
                    recordings : (data.recordings | 0),
                }),
                data.user | 0,
                data.project | 0,
            ]
        );
    },
};


module.exports = ActivationCodes;
