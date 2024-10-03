/* jshint node:true */
"use strict";


var debug = require('debug')('arbimon2:model:users');
var request = require('request');
var config = require('../config');
var util = require('util');
var q = require('q');
var APIError = require('../utils/apierror');
var sprintf = require("sprintf-js").sprintf;
const rp = util.promisify(request);
const rfcxConfig = config('rfcx');

var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;
var sha256 = require('../utils/sha256');
var generator = require('../utils/generator');
const auth0Service = require('./auth0');

const projects = require('./projects')

function hashPassword(password){
    return sha256(password);
}

var Users = {
    hashPassword: hashPassword,

    findByUsername: function(username, callback) {
        var q = 'SELECT * \n' +
                'FROM users \n' +
                'WHERE login = %s';
        q = util.format(q, dbpool.escape(username));
        queryHandler(q, callback);
    },

    findByEmail: function(email, callback) {
        var q = 'SELECT * \n' +
                'FROM users \n' +
                'WHERE email = %s';
        q = util.format(q, dbpool.escape(email));
        queryHandler(q, callback);
    },

    findByEmailAsync: function(email) {
        let findByEmail = util.promisify(this.findByEmail)
        return findByEmail(email)
    },

    findByRfcxId: function(email) {
        const q = `select * from users where rfcx_id = '${email}'`
        return dbpool.query(q)
    },

    findById: function(user_id, callback) {
        return q.nfcall(queryHandler,
            'SELECT * \n' +
            'FROM users \n' +
            'WHERE user_id = ?', [
                user_id
            ]
        ).get(0).nodeify(callback);
    },

    getInfoForId: function(user_id){
        return q.nfcall(queryHandler,
            'SELECT user_id, login, firstname, lastname\n' +
            'FROM users \n' +
            'WHERE user_id = ?', [
                user_id
            ]
        ).get(0);
    },

    search: function(query, callback) {
        query = dbpool.escape('%'+query+'%');

        var q = "SELECT user_id AS id, firstname, lastname, \n"+
                "       email, \n"+
                "       login AS username \n"+
                "FROM users \n"+
                "WHERE (login LIKE %s \n"+
                "OR email LIKE %s) \n"+
                "AND rfcx_id IS NOT NULL";

        q = util.format(q, query, query);
        queryHandler(q, callback);
    },

    update: function(userData, callback) {
        if(typeof userData.user_id === 'undefined') {
            callback(new Error("userData does not contain an user_id"));
            return;
        }

        var values=[], data=[];

        // process values to be updated
        for( var i in userData) {
            if(i !== 'user_id' && userData[i] !== undefined) {
                values.push(dbpool.escapeId(i) + ' = ?');
                data.push(userData[i]);
            }
        }
        data.push(userData.user_id);

        return q.nfcall(queryHandler,
            'UPDATE users \n'+
            'SET ' + values.join(', ') + ' \n'+
            'WHERE user_id=?', data
        ).nodeify(callback);
    },

    insert: function(userData, callback) {
        var values = [];

        var requiredValues = [
            "login",
            "password",
            "firstname",
            "lastname",
            "email"
        ];

        for(var i in requiredValues) {
            if(typeof userData[requiredValues[i]] === "undefined")
                return callback(new Error("required field '"+ requiredValues[i] + "' missing"));
        }

        for(i in userData) {
            if(i !== 'user_id') {
                values.push(util.format('%s = %s',
                    dbpool.escapeId(i),
                    dbpool.escape(userData[i])
                ));
            }
        }

        var q = 'INSERT INTO users \n'+
                'SET %s';

        q = util.format(q, values.join(", "));
        queryHandler(q, callback);
    },

    insertAsync: function(userData) {
        let insert = util.promisify(this.insert)
        return insert(userData)
    },

    projectList: function(query, callback) {
        let whereExp = [], data=[];
        let selectExtra = '';
        let joinExtra = '';

        selectExtra = "p.project_id AS id, name, url, lat, lon, description, is_private, u.login AS `owner`";

        joinExtra = "JOIN user_project_role AS upr ON (p.project_id = upr.project_id and upr.role_id = 4) \n"+
        "JOIN user_project_role AS upr2 ON (p.project_id = upr2.project_id) \n"+
        "JOIN users AS u ON (upr.user_id = u.user_id) \n"+
        "LEFT JOIN (SELECT project_id, lat, lon, MAX(site_id) as maxSiteId FROM sites GROUP BY project_id) site ON p.project_id = site.project_id \n";

        whereExp.push('upr2.user_id = ? OR p.is_private = 0');
        data.push(query.user_id);

        if(query.hasOwnProperty('q')) {
            whereExp.push("p.name LIKE '%"+query.q+"%' OR p.description LIKE '%"+query.q+"%'");
        }
        if (query.hasOwnProperty('publicTemplates')) {
            whereExp.push('p.deleted_at IS NULL');
        }

        return dbpool.query(
            "SELECT " + selectExtra + " \n" +
            "FROM projects AS p \n" + joinExtra +
            "WHERE (" + whereExp.join(") \n" +
            "  AND (") + ") GROUP BY p.project_id", data
        ).nodeify(callback);
    },

    getProjectList: function(userId){
        return dbpool.query(
            "SELECT is_super FROM users WHERE user_id = ?", [
            userId
        ]).get(0).then(function(user){
            if(user.is_super){
                return q.ninvoke(projects, 'listAll').get(0);
            } else {
                return Users.projectList(userId);
            }
        });
    },

    /** Return whether a given user has access to a given project.
     * @param {Number} userId - id of the user.
     * @param {Number} projectId - id of the project.
     * @param {Boolean} options - options
     * @param {Boolean} options.required - if user has no access, then an error should be thrown.
     * @return {Promise<Boolean>}  value indicating wether the user has access to a project or not.
     */
    hasProjectAccess: function(userId, projectId, options){
        return dbpool.query(
            "SELECT U.is_super, P.is_private, UPR.role_id\n" +
            "FROM users U\n" +
            "JOIN projects P\n" +
            "LEFT JOIN user_project_role UPR ON U.user_id = UPR.user_id AND P.project_id = UPR.project_id\n" +
            "WHERE U.user_id = ? AND P.project_id = ?", [
            userId, projectId
        ]).get(0).then(function(results){
            var hasAccess = results.is_super || !results.is_private || !!results.role_id;
            if(!hasAccess && options && options.required){
                throw new APIError("You cannot access this project.", 404);
            }
            return hasAccess;
        });
    },

    getPermissions : function(user_id, project_id, callback) {
        return dbpool.query(
            'SELECT p.permission_id AS id, p.name \n'+
            'FROM user_project_role AS upr \n'+
            'JOIN roles AS r ON upr.role_id = r.role_id \n'+
            'JOIN role_permissions AS rp ON rp.role_id = upr.role_id \n'+
            'JOIN permissions AS p ON p.permission_id = rp.permission_id \n'+
            'WHERE upr.user_id = ? \n'+
            'AND upr.project_id = ?', [
            user_id,
            project_id
        ]).nodeify(callback);
    },

    getProjectRole : async function(user_id, project_id) {
        const q = `select r.name from roles r
            join user_project_role upr on r.role_id = upr.role_id
            where upr.user_id = ${user_id} and upr.project_id = ${project_id}`
        return dbpool.query(q).get(0);
    },

    findOwnedProjects: function(user_id, query) {
        return dbpool.query(
            "SELECT p.* \n"+
            "FROM projects as p \n"+
            "JOIN user_project_role AS upr ON (p.project_id = upr.project_id and upr.role_id = 4) \n"+
            "WHERE upr.user_id = ?", [
            user_id
        ]);
    },

    newAccountRequest: function(params, hash, callback){
        var q = 'INSERT INTO user_account_support_request'+
                '(support_type_id, hash, params, expires) \n'+
                'VALUES (1,' +
                dbpool.escape(hash) + ','+
                dbpool.escape(JSON.stringify(params))+ ','+
                '(\n'+
                '    SELECT FROM_UNIXTIME( \n'+
                '        UNIX_TIMESTAMP(now()) +\n' +
                '        (SELECT max_lifetime \n'+
                '         FROM user_account_support_type\n' +
                '         WHERE account_support_type_id = 1)\n'+
                '    ) as expiresin \n'+
                '))';

        queryHandler(q, callback);
    },

    newPasswordResetRequest: function(user_id, hash, callback) {
        var q = 'INSERT INTO user_account_support_request'+
                '(support_type_id, user_id, hash, expires) \n'+
                'VALUES (2,' +
                dbpool.escape(user_id) + ','+
                dbpool.escape(hash) + ','+
                '(\n'+
                '    SELECT FROM_UNIXTIME( \n'+
                '        UNIX_TIMESTAMP(now()) +\n' +
                '        (SELECT max_lifetime \n'+
                '         FROM user_account_support_type\n' +
                '         WHERE account_support_type_id = 2)\n'+
                '    ) as expiresin \n'+
                '))';

        queryHandler(q, callback);
    },

    removeRequest : function(id, callback) {
        var q = 'DELETE FROM user_account_support_request \n'+
                'WHERE support_request_id = '+ dbpool.escape(id);

        queryHandler(q, callback);
    },

    findAccountSupportReq: function(hash, callback) {
        var q = 'SELECT * \n'+
                'FROM user_account_support_request \n'+
                'WHERE hash = ' + dbpool.escape(hash);

        queryHandler(q, callback);
    },

    usernameInUse: function(username, callback) {
        var q = "SELECT (SELECT count(*) as count \n"+
            "FROM user_account_support_request \n"+
            "WHERE params LIKE %1$s) \n+\n"+
            "(SELECT count(*) as count \n"+
            "FROM users AS u \n"+
            "WHERE login = %2$s) as count";

        q = sprintf(q, dbpool.escape('%"'+username+'"%'), dbpool.escape(username));
        queryHandler(q, function(err, rows){
            if(err) return callback(err);

            callback(null, rows[0].count > 0);
        });
    },

    emailInUse: function(username, callback) {
        var q = "SELECT (SELECT count(*) as count \n"+
            "FROM user_account_support_request \n"+
            "WHERE params LIKE %1$s) \n+\n"+
            "(SELECT count(*) as count \n"+
            "FROM users AS u \n"+
            "WHERE email = %2$s) as count";

        q = sprintf(q, dbpool.escape('%"'+username+'"%'), dbpool.escape(username));
        queryHandler(q, function(err, rows){
            if(err) return callback(err);

            callback(null, rows[0].count > 0);
        });
    },

    list: function(callback) {
        var q = 'SELECT user_id AS id, \n' +
                'login AS username, \n' +
                'firstname, \n' +
                'lastname, \n' +
                'email, \n' +
                'last_login, \n' +
                'is_super, \n' +
                'created_on, \n' +
                'disabled_until \n' +
                'FROM users';

        queryHandler(q, callback);
    },

    listUser: function(callback) {
        var q = 'SELECT user_id AS id, \n' +
                'firstname, \n' +
                'lastname, \n' +
                'email \n' +
                'FROM users';

        queryHandler(q, callback);
    },

    countCreatedToday: function(callback) {
        var q = 'SELECT count(*) AS count \n'+
                'FROM `users` \n'+
                'WHERE DATE(created_on) = DATE(NOW())';

        queryHandler(q, callback);
    },

    countAllUsers: function(callback) {
        var q = 'SELECT count(*) AS count \n'+
                'FROM `users`';

        queryHandler(q, callback);
    },

    challengeOAuth: function(credentials){
        var result = {
            user: null,
            error: null,
        };
        return q.ninvoke(Users, "findByEmail", credentials.email).get(0).get(0).then(function(userByEmail){
            result.user = userByEmail;

            if(!userByEmail){
                // User does not exist!!!
            } else if(userByEmail.disabled_until === '0000-00-00 00:00:00'){
                result.error = new APIError("This account had been disabled", 423);
            } else if(!userByEmail["oauth_" + credentials.type]){
                // User has not authorized login with the given oauth, thus this needs be confirmed.
                result.error = new APIError("Must first authorize " + credentials.type + " oauth.", 449);
            }
            return result;
        });
    },

    /** Executes a user login challenge, returning its promised results.
     * @params auth
     * @params auth.username
     * @params auth.password
     * @params auth.captcha
     * @params options - options
     * @params options.captcha
     * @params options.compareUsername
     */
    challengeLogin: function(auth, options){
        options = options || {};
        var username = auth.username || '';
        var password = auth.password || '';
        var ip = auth.ip;
        var captchaResponse = auth.captcha;
        var redirectUrl = options.redirect || '/projects';

        var permitedRetries = 10;
        var captchaRequired = 3;
        var waitTime = 3600000; // miliseconds
        var now = new Date();

        var result = {};

        return q.all([
            //find user
            q.ninvoke(Users, "findByUsername", username).get(0).get(0)
        ]).then(function(all){
            var invalidLogins = all[0];
            var user = all[1] || null;

            var tries;

            if(!user) {
                tries = invalidLogins.tries;
            } else {
                tries =user.login_tries;
            }

            result.user = user;
            result.tries = tries;

            debug('login tries:', tries);

            if(user && (user.disabled_until === '0000-00-00 00:00:00') ){
                throw new APIError("This account had been disabled");
            }

            if(tries >=  permitedRetries || (user && (user.disabled_until > now) ) ) {
                // TODO:: esto dice una hora pero no necesariamente es una, o si?
                throw new APIError("Too many tries, try again in 1 hour. If you think this is wrong contact us.");
            }

            return result;
        }).then(function(result){
            // verify if user not exceeded max retries check captcha if needed
            if(result.tries >= captchaRequired && !options.skipCaptcha) {
                return q.nfcall(request, {
                    uri:'https://www.google.com/recaptcha/api/siteverify',
                    qs: {
                        secret: config('recaptcha').secret,
                        response: captchaResponse,
                        remoteip: ip,
                    }
                }).then(function(args) {
                    var response = args[0];
                    var body = args[1];

                    body = JSON.parse(body);

                    debug('captcha validation:\n', body);

                    return body.success;
                });
            } else {
                return true;
            }
        }).then(function(captchaResult){
            result.verifyCaptcha = captchaResult;
        }).then(function(){
            var user = result.user;
            var tries = result.tries;
            var response = {};

            if(!result.verifyCaptcha) {
                result.error = "Error validating captcha";
                result.reason = 'invalid_captcha';
            } else if(!user) {
                result.error = "Invalid username or password";
                result.reason = 'invalid_username';
            } else if(hashPassword(password) !== user.password){
                result.error = "Invalid username or password";
                result.reason = 'invalid_password';
            } else {
                result.success = true;
                result.redirect = redirectUrl;
            }

            if(result.error) {
                result.captchaNeeded = (tries + 1) >= captchaRequired;
                result.tries += 1;
                if(result.tries >= permitedRetries) {
                    now.setHours(now.getHours() + 1);
                    result.disable_until = now;
                }
            }

            return result;
        });
    },

    performLogin: function(req, auth, options){
        return Users.challengeLogin(auth, {
            redirect : req.query.redirect
        }).then(function(result){
            var user = result.user;
            var tries = result.tries;
            var response = {};

            if(result.error) {
                if(user) {
                    q.ninvoke(Users, "update", result.disable_until ? {
                        user_id: user.user_id,
                        login_tries: 0,
                        disabled_until : result.disable_until
                    } : {
                        user_id: user.user_id,
                        login_tries: user.login_tries + 1
                    }).catch(console.error.bind(console));
                }

                return {
                    success: false,
                    error: result.error,
                    captchaNeeded: result.captchaNeeded
                };
            }

            // update user info
            q.ninvoke(Users, "update", {
                user_id: user.user_id,
                last_login: new Date(),
                login_tries: 0
            }).catch(console.error.bind(console));

            // set session
            req.session.loggedIn = true;
            req.session.isAnonymousGuest = false;
            req.session.user = Users.makeUserObject(user, {secure: req.secure, all:true});

            return {
                success: true,
                redirect : req.query.redirect || '/my-projects',
                captchaNeeded: result.captchaNeeded
            };
        });
    },

    createFromAuth0: async function(profile) {
        const password = generator.generate(20)
        const email = this.getEmailFromAuth0Profile(profile)
        const attrs = {
            login: profile.sub,
            password: hashPassword(password),
            firstname: profile.given_name || (profile.user_metadata ? profile.user_metadata.given_name : ''),
            lastname: profile.family_name || (profile.user_metadata ? profile.user_metadata.family_name : ''),
            email: email,
            created_on: new Date(),
            rfcx_id: email,
        }
        const insertData = await this.insertAsync(attrs)
        return this.findById(insertData.insertId).get(0)
    },


    getEmailFromAuth0Profile: function (profile) {
        return profile.email || `${profile.guid}@rfcx.org`;
    },

    createByInvitation: async function (data) {
        const attrs = {
            ...data,
            login: `invited|${generator.generate(20)}`,
            password: generator.generate(20),
            created_on: new Date(),
            rfcx_id: data.email,
        }
        const insertData = await this.insertAsync(attrs)
        return this.findById(insertData.insertId).get(0)
    },

    makeUserObject: function(user, options){
        options = options || {};
        let userObj = {
            id: user.user_id,
            username: user.login,
            imageUrl: user.picture ? user.picture : null,
            isSuper: user.is_super,
            isRfcx: user.email.includes('rfcx.org')
        };
        if(options.all){
            userObj.isAnonymousGuest = false;
            userObj.firstname = user.firstname;
            userObj.lastname = user.lastname;
            userObj.email = user.email;
            userObj.oauth = {
                google: user.oauth_google,
                facebook: user.oauth_facebook
            };
            userObj.rfcx_id = user.rfcx_id
        }
        return userObj;
    },

    /** Attempts to log in the user using validated oauth credentials.
     * @params req - request holding the session (for logging in ofcourse)
     * @params credentials - oauth credentials in question
     * @params options - options
     * @params options.authorize - whether to authorize the oauth login (if not previously authorized)
     * @params options.username - username used in the oauth autorization.
     * @params options.password - password used in the oauth autorization.
     */
    oauthLogin: function(req, credentials, options) {
        options = options || {};
        var now = new Date();
        return this.challengeOAuth(credentials).then(function(result){
            if(!result.error && !result.user){
                // No error and User does not exist!!!, it must be created, then OAuth is deemed sucessfull with the created user.
                return Users.createFromOAuth(credentials);
            } else if(result.error){
                if(result.error.status == 449 && options.authorize){
                    return Users.challengeLogin({
                        username: options.username,
                        password: options.password
                    }, {
                        skipCaptcha: true,
                        compareUsername: result.user.login
                    }).then(function(loginResult){
                        if(loginResult.error){
                            console.log("loginResult.error", loginResult.error);
                            throw loginResult.error;
                        }

                        var userData={user_id: loginResult.user.user_id};
                        userData['oauth_' + credentials.type] = 1;

                        return q.ninvoke(Users, "update", userData).then(function(){
                            return loginResult.user;
                        });
                    });
                }
                // Error in challenge
                throw result.error;
            } else {
                return result.user;
            }
        }).then(function(authenticatedUser) {
            // update user info
            return q.ninvoke(Users, "update", {
                user_id: authenticatedUser.user_id,
                last_login: new Date(),
                login_tries: 0
            }).then(function(){
                // set session
                req.session.loggedIn = true;
                req.session.isAnonymousGuest = false;
                req.session.user = Users.makeUserObject(authenticatedUser, {secure: req.secure, all:true});

                return authenticatedUser;
            });
        });
    },

    auth0Login: async function(req, profile, tokens) {
        const user = await this.ensureUserExistFromAuth0(profile)
        this.refreshLastLogin(user.user_id)

        // set session
        req.session.loggedIn = true;
        req.session.isAnonymousGuest = false;
        req.session.user = Users.makeUserObject(user, profile, {secure: req.secure, all:true});
        req.session.idToken = tokens.id_token
        return user
    },

    connectRFCx: async function(req, profile, tokens) {
        const userId = req.session.user.id;
        const email = this.getEmailFromAuth0Profile(profile);
        // if user authenticates with different email, check if there is another user with this email
        if ((req.session.user.email || '').toLowerCase() !== email.toLowerCase()) {
            const foreignUser = await q.ninvoke(Users, "findByEmail", email).get(0).get(0);
            if (foreignUser) {
                console.log('foreignUser')
                // throw new Error('The email address associated with this RFCx account is already used by another Arbimon user. Please use a different RFCx account.')
            }
        }
        await q.ninvoke(Users, "update", {
            user_id: userId,
            rfcx_id: email
        })
        const user = await q.ninvoke(Users, "findById", userId).get(0);
        req.session.loggedIn = true;
        req.session.isAnonymousGuest = false;
        req.session.user = Users.makeUserObject(user, { secure: req.secure, all: true });
        req.session.idToken = tokens.id_token
    },

    ensureUserExistFromAuth0: async function(profile) {
        const email = this.getEmailFromAuth0Profile(profile);
        const [userByRfcxId] = await this.findByRfcxId(email);
        if (userByRfcxId) {
            return userByRfcxId;
        }
        const [userByEmail] = await this.findByEmailAsync(email)
        if (userByEmail) {
            await q.ninvoke(Users, "update", {
                user_id: userByEmail.user_id,
                rfcx_id: email
            })
            return await q.ninvoke(Users, "findByEmail", email).get(0).get(0);
        }
        return await Users.createFromAuth0(profile)
    },

    sendTouchAPI: function(idToken) {
        const options = {
            method: 'GET',
            url: `${rfcxConfig.apiBaseUrl}/v1/users/touchapi`,
            headers: {
              Authorization: `Bearer ${idToken}`
            },
            json: true
          }

          return rp(options)
    },

    refreshLastLogin: function(user_id) {
        q.ninvoke(Users, "update", {
            user_id,
            last_login: new Date(),
            login_tries: 0
        }).catch(console.error.bind(console));
    },

    queryPermission: function(user_id, project_id, permission_name) {
        return dbpool.query(
            "(" +
            "   SELECT 0 as is_super, UPR.role_id as role\n" +
            "   FROM user_project_role UPR\n" +
            "   JOIN role_permissions RP ON UPR.role_id = RP.role_id\n" +
            "   JOIN permissions P ON RP.permission_id = P.permission_id\n" +
            "   WHERE UPR.user_id = ? AND UPR.project_id = ?\n" +
            ") UNION (" +
            "   SELECT U.is_super, 0 as role\n" +
            "   FROM users U\n" +
            "   WHERE U.user_id = ?\n" +
            "     AND U.is_super = 1\n" +
            ")", [
                (user_id | 0), (project_id | 0),
                (user_id | 0)
            ]
        ).then(function(permissions){
            return permissions.length > 0;
        });
    },

    createInCoreAPI: function(body) {
        return auth0Service.getToken()
            .then((token) => {
                const options = {
                    method: 'POST',
                    url: `${rfcxConfig.apiBaseUrl}/users`,
                    headers: {
                        'content-type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body,
                    json: true
                }
                return rp(options)
            })
    },

    inviteUser: function (user) {
        return Users.createInCoreAPI(user)
            .then(() => {
                return Users.createByInvitation(user)
            })
    }
};

module.exports = Users;
