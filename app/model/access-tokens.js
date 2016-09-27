/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:model:users');
var request = require('request');
var jsonwebtoken = require('jsonwebtoken');
var config = require('../config');
var util = require('util');
var q = require('q');
var APIError = require('../utils/apierror');
var sha256 = require('../utils/sha256');
var models = require('./index');



var AccessTokens = {
    /** Requests an access token with a given scope. The token is awarded if
     * a login challenge is successfull or if a parent token with a broader scope is given.
     *
     * @params options - options
     * @params options.token    - From wich to derive the requested token.
     * @params options.username - username used in the oauth autorization.
     * @params options.password - password used in the oauth autorization.
     * @params options.project  - project associated to the requested token.
     * @params options.site     - site associated to the requested token.
     * @params options.scope    - the scope being requested.
     *
     * @returns {Promise} resolving to an access token, if the challenge was successful.
     */
    requestAccessToken: function(options){
        options = options || {};
        return AccessTokens.challengeAccessTokenRequest(options).then(function(result){
            return AccessTokens.constructAccessToken(result, options.scope);
        });
    },
    
    /** Constructs an access token, given a scope and authentication information.
     *
     * @params auth - token authentication data
     * @params auth.user - id of the user represented by the token
     * @params auth.project  - project associated to the token.
     * @params auth.site     - site associated to the token.
     * @params auth.mustBeShortLived     - indicates that the token should expire promptly.
     * @params scope    - the scope associated to the token.
     *
     * @returns {String} access token with the given data.
     */
    constructAccessToken: function(auth, scope){
        var payload = {a2at:true, scope: scope};
        if(auth.token){
            payload.project = auth.token.project;
            payload.site    = auth.token.site;
            payload.user    = auth.token.user;
        } else {
            payload.user = auth.user;
        }
        if(auth.mustBeShortLived){
            payload.expires = new Date().getTime() + 3600000;
        }
        
        return jsonwebtoken.sign(payload, config('tokens').secret, config('tokens').options);
    },
    
    /** Challenges a given token request.
     *
     * @params options - options
     * @params options.token    - A parent token authenticating the challenge.
     * @params options.username - username of the user authenticating the challenge.
     * @params options.password - password of the user authenticating the challenge.
     * @params options.project  - project associated to the requested token.
     * @params options.site     - site associated to the requested token.
     * @params options.scope    - the scope being requested.
     *
     * @returns {Promise} resolving to a challenge result containing the user or token that passed the challenge,
     *                    or rejecting with an error if the challenge failed.
     */
    challengeAccessTokenRequest: function(options){
        options = options || {};
        var challengeResult;
        return (
            options.token ? 
            AccessTokens.verifyTokenAccess(options.token, options.scope).then(function(token){
                return {token: token};
            }) :
            models.users.challengeLogin({
                username: options.username,
                password: options.password
            }, {
                skipCaptcha: true
            }).then(function(result){
                if(result.error){
                    throw new APIError(result.error);
                }
                return {user:result.user.user_id};
            })
        ).then(function(result){
            challengeResult = result;
        }).then(function(){
            if(challengeResult.user && (options.project || options.site)){
                throw new APIError("Cannot request project or site access token without a parent access token.");
            } else if(challengeResult.token){
                challengeResult.mustBeShortLived = true;
                return q.resolve().then(function(){
                    if(options.project){
                        if(challengeResult.token.project && challengeResult.token.project != options.project){
                            throw new APIError("Cannot use a project access token to request access for another project.");
                        } else {
                            return models.users.queryPermission(challengeResult.token.user, options.project, 'manage project').then(function(hasPermission){
                                if(!hasPermission){
                                    throw new APIError("You do not have permission to access this project.");
                                } else {
                                    challengeResult.token.project = options.project | 0;
                                }
                            });
                        }
                    } else if(challengeResult.token.project){
                        throw new APIError("Cannot use a project access token to request a non-project access token.");
                    }
                }).then(function(){
                    if(options.site){
                        if(!challengeResult.token.project){
                            throw new APIError("Cannot request site token without project info.");
                        } else if(challengeResult.token.site && challengeResult.token.site != options.site){
                            throw new APIError("Cannot use a site access token to request access for another site.");
                        } else {
                            return models.projects.determineIfSiteInProject(challengeResult.token.project, options.site, {ignoreImported:true}).then(function(isInProject){
                                if(!isInProject){
                                    throw new APIError("The given site is not accessible from the given project.");
                                } else {
                                    challengeResult.token.site = options.site | 0;
                                }
                            });
                        }
                    } else if(challengeResult.token.site){
                        throw new APIError("Cannot use a site access token to request a non-site access token.");
                    }
                });
            }
        }).then(function(){
            console.log("challengeResult   ", challengeResult);
            return challengeResult;
        });
    },
    
    /** Decodes a given token and verifies that it is valid.
     * @param {String} token - the token to decode/verify.
     * @param {Object} options - options object.
     * @param {Boolean} options.resolveIds - whether to resolve the ids in the token or not (default false).
     *
     * @returns {Promise} resolving to decoded token, or rejected if the token is not valid or has expired.
     */
    resolveAccessToken: function(token, options){
        console.log("resolve :: ", token);
        options = options || {};
        return q.ninvoke(jsonwebtoken, 'verify', token, config('tokens').secret, config('tokens').options).then(function(decodedToken){
            console.log("decodedToken", decodedToken);
            if(!decodedToken.a2at){
                throw new Error("Token is not a valid Access Token.");
            }
            if(decodedToken.expires && decodedToken.expires < new Date().getTime()){
                throw new Error("Token has expired.");
            }
            if(options.resolveIds){
                return q.all([
                    q(decodedToken.scope),
                    q.ninvoke(models.users, "findById", decodedToken.user).get(0).then(function(user){
                        return models.users.makeUserObject(user, {secure: true, profile: true});
                    }),
                    decodedToken.project ? models.projects.find({id:decodedToken.project}).get(0) : q(),
                    decodedToken.site ? models.sites.findById({id:decodedToken.site}).get(0).get(0) : q()
                ]).then(function(all){
                    return {
                        scope   : all[0],
                        user    : all[1],
                        project : all[2],
                        site    : all[3],
                    };
                });
            } else {
                return decodedToken;
            }
        });
    },

    /** Resolves a given token and verifies that it has the access being queried.
     * @param {String} token - the token to decode/verify.
     * @param {String} scope - the scope against which to compare the token.
     * @param {Object} options - options object, allowed options include those in resolveAccessToken().
     * @param {Boolean} options.allowEmptyScope - wether an empty scope is allowed in the query or not.
     * @param {Boolean|Number} options.requireSite - required id of the site for this token. If === true, then any site passes.
     * @param {Boolean|Number} options.requireProject - required id of the project for this token. If === true, then any project passes.
     *
     * @returns {Promise} resolving to resolved token, if the token is valid and includes the required scope.
     */
    verifyTokenAccess: function(token, scope, options){
        options = options || {};
        scope = options.allowEmptyScope && !scope ? [] : scope.split(',');
        return AccessTokens.resolveAccessToken(token, options).then(function(decodedToken){
            var tokenScopeMap = decodedToken.scope.split(',').reduce(function(_, scopeItem){
                _[scopeItem] = true;
                return _;
            }, {});
            var isTokenScopeSubset = scope.reduce(function(_, scopeItem){
                return _ && tokenScopeMap[scopeItem];
            }, true);
            if(!isTokenScopeSubset){
                throw new Error("Token does not include given scope.");
            } else if(options.requireSite && (options.requireSite === true ? !decodedToken.site : options.requireSite != decodedToken.site)){
                throw new Error(options.requireSite === true ? "Token does not include a site" : "Token is not for the given site.");
            } else if(options.requireProject && (options.requireProject === true ? !decodedToken.project : options.requireProject != decodedToken.project)){
                throw new Error(options.requireProject === true ? "Token does not include a project" : "Token is not for the given project.");
            } else {
                return decodedToken;
            }
        });
    },

};

module.exports = AccessTokens;
