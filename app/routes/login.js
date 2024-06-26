/* jshint node:true */
"use strict";

var debug = require('debug')('arbimon2:route:login');
var express = require('express');
var router = express.Router();
var gravatar = require('gravatar');
var mcapi = require('mailchimp-api');
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var async = require('async');
var validator = require('validator');
var request = require('request');
var ejs = require('ejs');
var fs = require('fs');
var path = require('path');
var url = require('url');
var dd = console.log;
var q = require('q');
var config = require('../config');
var model = require('../model/');
var sha256 = require('../utils/sha256');
const auth0Service = require('../model/auth0')

var mc = new mcapi.Mailchimp(config('mailchimp').key);

var mailTemplates = {
    activate: ejs.compile(fs.readFileSync(path.resolve(__dirname, '../views/mail/activate-account.ejs')).toString()),
    resetPass: ejs.compile(fs.readFileSync(path.resolve(__dirname, '../views/mail/reset-password.ejs')).toString())
};

const mandrill = require('mandrill-api/mandrill');
const mandrill_client = new mandrill.Mandrill(config('mandrill_key').key)

const anonymousGuest = {
    id: 0,
    username: 'guest',
    email: '',
    firstname: 'Anonymous',
    lastname: 'Guest',
    isAnonymousGuest: true,
    isSuper: 0,
    isRfcx: 0,
    imageUrl: ''
}

router.use(function create_user_object(req, res, next) {
    const session = req.session
    const permissions = session.user && session.user.permissions ? session.user.permissions : undefined
    if (!req.user) {
        session.isAnonymousGuest = true;
        session.user = anonymousGuest;
        next();
    }
    else if (session && req.user && req.user.email) {
        q.ninvoke(model.users, 'findByEmail', req.user.email).get(0).then(async user => {
            if (!user.length) {
                session.isAnonymousGuest = true;
                session.user = anonymousGuest;
                next();
            }
            session.isAnonymousGuest = false;
            user[0].picture = req.user.picture
            session.user = model.users.makeUserObject(user[0], {secure: req.secure, all:true});
            session.user.permissions = permissions
            next();
        })
    }
});

router.use(function(req, res, next) {

    req.haveAccess = function(project_id, permission_name) {
        if(req.session.user.isSuper === 1)
            return true;

        var projectPerms = req.session.user.permissions && req.session.user.permissions[project_id];
        if(!projectPerms)
            return false;

        var havePermission = projectPerms.filter(function(perm) {
            return perm.name === permission_name;
        });

        return havePermission.length > 0;
    };

    next();
});

router.get('/legacy-api/login_available', function(req, res, next) {
    res.type('json');
    if(!req.query.username) {
        return res.json({ error: "missing parameter"});
    }

    model.users.usernameInUse(req.query.username, function(err, inUse) {
        if(err) return next(err);

        res.json({ available: !inUse });
    });
});

router.get('/legacy-api/email_available', function(req, res, next) {
    res.type('json');
    if(!req.query.email) {
        return res.json({ error: "missing parameter"});
    }

    if(!validator.isEmail(req.query.email)) {
        return res.json({ invalid: true });
    }

    model.users.emailInUse(req.query.email, function(err, inUse) {
        if(err) return next(err);

        res.json({ available: !inUse });
    });
});

router.get('/login', function(req, res) {
    res.type('html');
    if(req.session) {
        if (req.session.loggedIn) {
            console.log('\n\n---TEMP: /login redirect to my projects loggedIn user')
            return res.redirect('/projects');
        }
    }
    return res.redirect('/');
});


router.post('/login', function(req, res, next) {
    res.type('json');
    model.users.performLogin(req, {
        username : req.body.username,
        password : req.body.password,
        captcha  : req.body.captcha,
    }, {
        redirect : req.query.redirect
    }).then(function(result){
        res.json(result);
    }).catch(next);
});

router.get('/legacy-login', (req, res, next) => {
    if (!req.user) {
        console.log('\n\n---TEMP2: auth req.originalUrl', req.originalUrl, req.session.currentPath)
        return res.redirect(auth0Service.universalLoginUrl)
    }
})
router.get('/legacy-login-callback', async function(req, res, next) {
    res.type('html');
    try {
        const query = req.query || {}
        if (query.error) {
            return next(new Error(query.error_description))
        }
        if (!query.code) {
            return next(new Error('Invalid authentication data: query code'))
        }
        const tokens = await auth0Service.getTokensByCode(query.code)
        if (!tokens) {
            return next(new Error('Invalid authentication data: user token'))
        }
        const profile = auth0Service.parseTokens(tokens)
        model.users.sendTouchAPI(tokens.id_token)
        await model.users.auth0Login(req, profile, tokens);
        if (!req.session === undefined && !req.session.currentPath) {
            console.log('\n\n---TEMP: legacy-login-callback session undefined')
            return res.redirect('/projects');
        }
        if (!req.session.currentPath) {
            console.log('\n\n---TEMP: legacy-login-callback session.currentPath', req.session.currentPath)
            return res.redirect('/projects');
        }
        return res.redirect(req.session.currentPath)
    } catch (e) {
        next(e)
    }
});

router.get('/legacy-logout', function(req, res, next) {
    res.type('json');
    req.session.destroy(function(err) {
        if(err) return next(err);
        console.log('\n\n----TEMP: /legacy-logout req.query', req.query)
        if (req.query && req.query.redirect && (req.query.redirect === 'false' || req.query.redirect === false)) { 
            return res.status(200).json({message: 'legacy session destroyed'});
        }
        console.log('\n\n----TEMP: /legacy-logout redirect to logoutUrl')
        return res.redirect(auth0Service.logoutUrl)
    });
});

router.get('/register', function(req, res) {
    res.redirect('/');
});

router.get('/activate/:hash', function(req, res, next) {
    res.type('html');
    model.users.findAccountSupportReq(req.params.hash, function(err, data) {
        if(err) return next(err);

        var now = new Date();

        if(!data.length)
        {
            res.render('activate', {
                user: null,
                login: false,
                status: 'Invalid activation link.'
            });

            return;
        }

        if(data[0].expires < now) {
            model.users.removeRequest(data[0].support_request_id, function(err, info){
                if(err) return next(err);

                res.render('activate', {
                    user: null,
                    login: false,
                    status: 'Your activation link has expired. You need to register again.'
                });
            });

            return;
        }


        var userInfo = JSON.parse(data[0].params);

        debug('Activate user', userInfo);

        userInfo.created_on = new Date();

        model.users.insert(userInfo, function (err,datas) {
            if(err) return next(err);

            model.users.removeRequest(data[0].support_request_id, function(err, info){
                if(err) return next(err);

                res.render('activate',{
                    user: null,
                    login: true,
                    status:'<b>'+userInfo.login+'</b> your account has been activated.'
                });
            });
        });
    });
});

router.post('/register', function(req, res, next) {
    res.type('json');
    // console.log(req.body);

    var user = req.body.user;
    var captchaNeeded = config('recaptcha').needed !== false;
    var captchaResponse = req.body.captcha;
    var subscribeToNewsletter = req.body.newsletter;

    if(!user || (captchaNeeded && !captchaResponse)) {
        return res.status(400).json({ error: "missing parameters" });
    }

    async.waterfall([
        // validate userInfo
        function(callback) {
            var userInfoIsValid = (
                validator.isLength(user.firstName, 1, 255) &&
                validator.isLength(user.lastName, 1, 255) &&
                /^([\d\w\.-]){4,32}$/.test(user.username) &&
                validator.isEmail(user.email) &&
                validator.isLength(user.password, 6, 32)
            );

            if(!userInfoIsValid) {
                return res.status(400).json({ error: "user info invalid" });
            }

            callback(null);
        },
        // validate captcha if needed
        function(callback) {
            if(!captchaNeeded){
                return callback(null);
            }

            request({
                uri:'https://www.google.com/recaptcha/api/siteverify',
                qs: {
                    secret: config('recaptcha').secret,
                    response: captchaResponse,
                    remoteip: req.ip,
                }
            }, function(error, response, body) {
                if(error) {
                    console.error(error);
                    return res.sendStatus(500);
                }

                body = JSON.parse(body);

                debug('captcha validation:\n', body);

                if(!body.success) {
                    return res.status(400).json({ error: "Error validating captcha"});
                }

                callback(null);
            });
        },
        // check if username in use
        function(callback) {
            model.users.usernameInUse(user.username, function(err, inUse) {
                if(err) return next(err);

                if(inUse) {
                    return res.status(400).json({ error: "Username in use" });
                }
                callback(null);
            });
        },
        // check if email in use
        function(callback) {
            model.users.emailInUse(user.email, function(err, inUse) {
                if(err) return next(err);

                if(inUse) {
                    return res.status(400).json({ error: "An account exists with that email" });
                }
                callback(null);
            });
        },
        // create account request
        function(callback) {
            var salt = Math.ceil(new Date().getTime() / 1000).toString();
            var hash = sha256(salt+user.username+user.firstName+user.lastName+user.email);

            var userData = {
                login: user.username,
                firstname: user.firstName,
                lastname: user.lastName,
                email: user.email,
                password: sha256(user.password)
            };

            model.users.newAccountRequest(userData, hash, function(err, result) {
                if(err) {
                    return next(err);
                }

                callback(null, hash, result.insertId);
            });
        },
        // send confirmation
        function(hash, requestId, callback) {
			var mailOptions = {
				text:'RFCx Arbimon: Account activation',
				subject: 'RFCx Arbimon: Account activation',
				html: mailTemplates.activate({
                    fullName: user.firstName + ' ' + user.lastName,
                    username: user.username,
                    email: user.email,
					hash: hash,
					host: config('hosts').publicUrl
                }),
				from_email: 'support@rfcx.org',
				to: [{
				  "email": user.email,
				  "name": user.username,
				  "type": "to"
				}],
				"auto_html": true
			};

			mandrill_client.messages.send({"message": mailOptions, "async": true}, function() {
				debug('email sent to:', user.email);
                res.json({ success: true });
				callback(null);
			}, function(error){
				if(error){
					debug('sendmail error', error);
                    model.users.removeRequest(requestId, function(err, info) {
                        if(err)  return next(err);

                        res.status(500).json({ error: "Could not send confirmation email." });
                    });
                    return;
				}
			})
        },
        // call subscribe to newsletter
        function(callback) {
            if(!subscribeToNewsletter) {
                return;
            }

            var mcReq = {
                id: config('mailchimp').listId,
                email: { email: user.email },
                merge_vars: {
                    EMAIL: user.email,
                    FNAME: user.firstName,
                    LNAME: user.lastName
                }
            };

            mc.lists.subscribe(mcReq,
                function(data) {
                    debug('newsletter subscribe success: ', data);
                },
                function(error) {
                    console.error('newsletter subscribe error: ', error);
                }
            );
        },
    ]);

});

router.get('/forgot_request', function(req, res) {
    res.type('html');
    res.render('forgot-request', { user: null });
});

router.post('/forgot_request', function(req, res, next) {
    res.type('json');
    if(!validator.isEmail(req.body.email)) {
        return res.json({ error: 'Invalid email address'});
    }

    model.users.findByEmail(req.body.email, function(err, rows) {
        if(err) return next(err);

        if(!rows.length) {
            return res.json({ error: "no user register with that email"});
        }

        var user = rows[0];
        var salt = Math.ceil(new Date().getTime() / 1000).toString();
        var hash = sha256(salt+user.username+user.firstname+user.lastname+user.email);

		var mailOptions = {
            text:'RFCx Arbimon: Password reset',
			subject: 'RFCx Arbimon: Password reset',
			html: mailTemplates.resetPass({
                fullName: user.firstname + ' ' + user.lastname,
                username: user.login,
				hash: hash,
				host: config('hosts').publicUrl
            }),
            from_email: 'support@rfcx.org',
            to: [{
              "email": user.email,
              "name": user.firstname + ' ' + user.lastname,
              "type": "to"
            }],
            "auto_html": true
        };

		mandrill_client.messages.send({"message": mailOptions, "async": true}, function() {
			model.users.newPasswordResetRequest(user.user_id, hash, function(err, results) {
                if(err) return next(err);

                res.json({ success: true });
            });
        }, function(error){
			if(error) return next(error);
		})
    });
});


router.get('/reset_password/:hash', function(req, res, next) {
    res.type('html');
    var now = new Date();

    model.users.findAccountSupportReq(req.params.hash, function(err, rows) {
        if(err) return next(err);

        if(!rows.length) {
            return res.render('reset-password', { error: 'Invalid reset password link'});
        }

        if(rows[0].expires < now) {
            model.users.removeRequest(rows[0].support_request_id, function(err, results) {
                if(err) return next(err);

                res.render('reset-password', { error: 'Your reset password link has expired'});
            });
            return;
        }

        res.render('reset-password', { error: '' });
    });
});

router.post('/reset_password/:hash', function(req, res, next) {
    res.type('json');
    var now = new Date();

    model.users.findAccountSupportReq(req.params.hash, function(err, rows) {
        if(err) return next(err);

        if(!rows.length) return next();

        if(rows[0].expires < now) {
            model.users.removeRequest(rows[0].support_request_id, function(err, results) {
                if(err) return next(err);

                res.render('reset-password', { error: 'Your reset password link has expired'});
            });
            return;
        }

        model.users.update({
            user_id: rows[0].user_id,
            password: sha256(req.body.password),
        },
        function(err, results) {
            if(err) return next(err);

            model.users.removeRequest(rows[0].support_request_id, function(err, results) {
                if(err) return next(err);

                res.json({ success: true });
            });
        });
    });
});

module.exports = router;
