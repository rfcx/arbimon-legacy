/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:model:users');
var request = require('request');
var jsonwebtoken = require('jsonwebtoken');
var config = require('../config');
var util = require('util');
var q = require('q');
var APIError = require('../utils/apierror');
var dbpool = require('../utils/dbpool');
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
     * @params options.site     - site associated to the given token.
     * @params options.scope    - the scope being requested.
     */
    requestAccessToken: function(options){
        options = options || {};
        return AccessTokens.challengeAccessTokenRequest(options).then(function(result){
            return AccessTokens.constructAccessToken(result, options.scope);
        });
    },
    
    constructAccessToken: function(auth, scope){
        var payload = {a2at:true, scope: scope};
        if(auth.token){
            payload.project = auth.token.project;
            payload.site    = auth.token.site;
            payload.user    = auth.token.user;
        } else {
            payload.user = auth.user;
        }
        
        return jsonwebtoken.sign(payload, config('tokens').secret, config('tokens').options);
    },
    
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
                if(options.project){
                    if(challengeResult.token.project && challengeResult.token.project != options.project){
                        throw new APIError("Cannot use a project access token to request access for another project.");
                    } else {
                        return models.users.queryPermission(challengeResult.token.user, options.project, 'manage project').then(function(hasPermission){
                            if(!hasPermission){
                                throw new APIError("You do not have permission to access this project.");
                            }
                        });
                    }
                } else if(challengeResult.token.project){
                    throw new APIError("Cannot use a project access token to request a non-project access token.");
                }
                if(options.site){
                    if(!options.project){
                        throw new APIError("Cannot request site token without project info.");
                    } else if(challengeResult.token.site && challengeResult.token.site != options.site){
                        throw new APIError("Cannot use a site access token to request access for another site.");
                    }
                } else if(challengeResult.token.site){
                    throw new APIError("Cannot use a site access token to request a non-site access token.");
                }
            }
        }).then(function(){
            return challengeResult;
        });
    },
    
    resolveAccessToken: function(token, options){
        console.log("resolve :: ", token);
        options = options || {};
        return q.ninvoke(jsonwebtoken, 'verify', token, config('tokens').secret, config('tokens').options).then(function(decodedToken){
            console.log("decodedToken", decodedToken);
            if(!decodedToken.a2at){
                throw new Error("Token is not a valid Access Token.");
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
            } else {
                return decodedToken;
            }
        });
    },

};

module.exports = AccessTokens;
