/* jshint node:true */
"use strict";

var q = require('q');
var jsonwebtoken = require('jsonwebtoken');
var config = require('../config');
var request = require('request');
var crypto = require('crypto');
var APIError = require('../utils/apierror');

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
        return OAuth.types[type].verify(token);
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

            verify: function(token){
                return this.getKeyFor(token).then(function(key){
                    return jsonwebtoken.verify(token, key);
                }).then((function(verifiedToken){
                    return this.validate(verifiedToken);
                }).bind(this));
            },

            validate: function(token){
                if(token && /(https:\/\/)?accounts.google.com/.test(token.iss) && token.aud == config('google_api').oauthId){
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
        },
        facebook : {
            GRAPH_API_URL : "https://graph.facebook.com/",
            getAccessToken: function(token){
                return q(config('facebook_api').public.appId + '|' + config('facebook_api').secret);
            },
            getSecretProof: function(access_token){
                var hmac = crypto.createHmac('sha256', config('facebook_api').secret);
                hmac.setEncoding('hex');
                hmac.write(access_token);
                hmac.end();
                return hmac.read();
            },
            verify: function(token){
                var access_token, secret_proof, user_id;
                return this.getAccessToken().then((function(_access_token, _secret_proof){
                    access_token = _access_token;
                    return this.getSecretProof(access_token);
                }).bind(this)).then(function(_secret_proof){
                    secret_proof = _secret_proof;
                }).then((function(){
                    return q.nfcall(request, {
                        method: 'GET',
                        uri: this.GRAPH_API_URL + 'debug_token',
                        qs: {
                            input_token:token,
                            access_token:access_token
                        },
                        json: true
                    });
                }).bind(this)).then(function(args) {
                    var data = args[1] && args[1].data;
                    if(data &&
                        data.app_id == config('facebook_api').public.appId &&
                        data.expires_at * 1000 > new Date().getTime() &&
                        data.is_valid &&
                        data.scopes && data.scopes.indexOf('email') !=-1 && data.scopes.indexOf('public_profile') !=-1
                    ){
                        user_id = data.user_id;
                        return true;
                    } else {
                        throw new Error("Token is invalid or expired.");
                    }
                }).then((function(validatedData){
                    return this.token2NormalizedCredentials(access_token, secret_proof, user_id);
                }).bind(this));
            },
            token2NormalizedCredentials: function(accessToken, appSecretProof, userId){
                return q.nfcall(request, {
                    method: 'GET',
                    uri: this.GRAPH_API_URL + userId,
                    qs: {
                        access_token:accessToken,
                        fields:'email,first_name,last_name,locale',
                        appsecret_proof: appSecretProof
                    },
                    json: true
                }).then(function(response){
                    var data = response[1];
                    if(data && data.first_name && data.last_name && data.email){
                        return {
                            type: "facebook",
                            email: data.email,
                            email_verified: true,
                            name: data.first_name,
                            lastName: data.last_name,
                            locale: data.locale,
                            picture: data.picture,
                        };
                    } else {
                        throw new APIError('Could not get user data from facebook.', 502);
                    }
                });
            }
        }

    }
    
};

module.exports = OAuth;
