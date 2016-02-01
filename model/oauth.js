/* jshint node:true */
"use strict";

var q = require('q');
var jsonwebtoken = require('jsonwebtoken');
var config = require('../config');
var request = require('request');

var OAuth = {
    getKeyFor: function(token, type){
        return (OAuth.types[type] ? OAuth.types[type].getKeyFor(token) : q()).then(function(key){
            if(!key){
                throw new Error("No such oauth key found.");
            }
            
            return key;
        });
    },

    verify: function(token, type){
        var verified;
        return OAuth.getKeyFor(token, type).then(function(key){
            return jsonwebtoken.verify(token, key);
        }).then(function(verifiedToken){
            return OAuth.types[type].validate(verifiedToken);
        });
    },
    
    types: {
        google : {
            URL : "https://www.googleapis.com/oauth2/v1/certs",
            /**
            * Gets federated sign-on certificates to use for verifying identity tokens.
            * Returns certs as array structure, where keys are key ids, and values
            * are PEM encoded certificates.
            * @param {function=} callback Callback supplying the certificates
            */
            getKeys: function(callback) {
                var cache = this.cache || (this.cache = {
                    expires: 0, value : null
                });

                if (cache.expires && new Date() < cache.expires) {
                    return q(cache.keys);
                }

                return q.nfcall(request, { 
                    method: 'GET',
                    uri: this.URL,
                    json: true
                }).then(function(args) { 
                    var cControl = args[0].headers['cache-control'];
                    var cAge = cControl ? (
                        (/max-age=([0-9]*)/.exec(cControl) || [0,0])[1] * 1000
                    ) : -1;
                    cache.keys = args[1];
                    cache.expires = cAge >= 0 ? null : new Date(new Date() + cAge);
                    console.log("cache.keys", cache.keys);
                    return cache.keys;
                });
            },
                        
            getKeyFor: function(token){
                var completeToken = jsonwebtoken.decode(token, {complete: true});
                var keyId = completeToken && completeToken.header && completeToken.header.kid;
                console.log("getKeyFor: function(token){", completeToken);
                return this.getKeys().get(keyId);
            },

            validate: function(token){
                if(token && /(https:\/\/)?accounts.google.com/.test(token.iss) && token.aud == config('google-api').oauthId){
                    return q(this.token2NormalizedCredentials(token));
                }
                return q.reject(new Error("Invalid oauth token."));
            },
            token2NormalizedCredentials: function(googleIdToken){
                return {
                    type: "google",
                    email: googleIdToken.email,
                    email_verified: googleIdToken.email_verified,
                    name: googleIdToken.given_name,
                    lastName: googleIdToken.family_name,
                    locale: googleIdToken.locale,
                    picture: googleIdToken.picture,
                };
            }
        }
    }
    
};

module.exports = OAuth;
