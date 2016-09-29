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
var dd = console.log;

var config = require('../config');
var model = require('../model/');
var sha256 = require('../utils/sha256');

var mc = new mcapi.Mailchimp(config('mailchimp').key);

var mailTemplates = {
    activate: ejs.compile(fs.readFileSync(path.resolve(__dirname, '../views/mail/activate-account.ejs')).toString()),
    resetPass: ejs.compile(fs.readFileSync(path.resolve(__dirname, '../views/mail/reset-password.ejs')).toString())
};

var transport = nodemailer.createTransport({
    host: config('email').host,
    port: config('email').port,
    auth: config('email').auth,
    greetingTimeout: 60000, 
    tls: {
        rejectUnauthorized: false
    }
});

router.use(function create_anonymous_guest_if_not_logged_in(req, res, next){
    if(req.session && !req.session.loggedIn && (!req.session.isAnonymousGuest || !req.session.user)){
        
        var dummyEmail = new Date().getTime() + '@b.com';
        
        req.session.isAnonymousGuest = true;
        req.session.user = {
            id: 0,
            username: 'guest',
            email: '',
            firstname: 'Anonymous',
            lastname: 'Guest',
            isAnonymousGuest: true,
            isSuper: 0,
            imageUrl: gravatar.url(dummyEmail, { d: 'monsterid', s: 60 }, req.secure),
            projectLimit: 0
        };
        debug("Anonimous guest user created in session.");
    }
    next();
});

router.use(function(req, res, next) {
    
    req.haveAccess = function(project_id, permission_name) {
        
        if(req.session.user.isSuper === 1)
            return true;
        
        var projectPerms = req.session.user.permissions && req.session.user.permissions[project_id];
        debug("user permissions:", req.session.user.permissions);
        
        if(!projectPerms)
            return false;
        
        var havePermission = projectPerms.filter(function(perm) {
            return perm.name === permission_name;
        });
        
        return havePermission.length > 0;
    };
    
    next();
});

router.get('/api/login_available', function(req, res, next) {
    if(!req.query.username) {
        return res.json({ error: "missing parameter"});
    }
    
    model.users.usernameInUse(req.query.username, function(err, inUse) {
        if(err) return next(err);
        
        res.json({ available: !inUse });
    });
});

router.get('/api/email_available', function(req, res, next) {
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

router.get('/', function(req, res) {  
    if(req.session) { 
        if(req.session.loggedIn) return res.redirect('/home'); 
    }
    console.log("google_oauth_client:", config('google-api').oauthId);
    res.render('landing-page', { 
        message: '', 
        inject_data: {
            facebook_api: config('facebook-api').public,
            google_oauth_client: config('google-api').oauthId
        }
    });
});

router.get('/login', function(req, res) {  
    if(req.session) { 
        if(req.session.loggedIn) return res.redirect('/home'); 
    }
    res.render('login', { 
        message: '',
        inject_data: {
            facebook_api: config('facebook-api').public,
            google_oauth_client: config('google-api').oauthId
        }
    });
});


router.post('/login', function(req, res, next) {
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

/** Processes an oauth-based login.
 * response codes:
 *      200 - login accepted
 *      423 - account disabled
 *      449 - oauth no authorized on account
 */
router.post('/oauth-login', function(req, res, next) {
    res.type('json');
    model.oauth.verify(req.body.token, req.body.type).then(function(credentials){
        return model.users.oauthLogin(req, credentials, req.body);
    }).then(function(){
        res.json({
            success:true,
            redirect:'/home'
        });
    }, next);
});

router.get('/logout', function(req, res, next) {
    req.session.destroy(function(err) {
        if(err) return next(err);
        
        res.redirect('/');
    });
});

router.get('/register', function(req, res) {
    res.render('register');
});

router.get('/activate/:hash', function(req, res, next) {
    model.users.findAccountSupportReq(req.params.hash, function(err, data) {
        if(err) return next(err);
        
        var now = new Date();
        
        if(!data.length) 
        {
            res.render('activate', {
                login: false,
                status: 'Invalid activation link.'
            });
            
            return;
        }
        
        if(data[0].expires < now) {
            model.users.removeRequest(data[0].support_request_id, function(err, info){
                if(err) return next(err);
                
                res.render('activate', {
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
                    login: true,
                    status:'<b>'+userInfo.login+'</b> your account has been activated.'
                });
            });
        });
    });
});

router.post('/register', function(req, res, next) {
    // console.log(req.body);
    
    var user = req.body.user;
    var captchaResponse = req.body.captcha;
    var subscribeToNewsletter = req.body.newsletter;
    
    if(!user || !captchaResponse) {
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
        // validate captcha
        function(callback) {
            
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
                from: 'Sieve-Analytics <support@sieve-analytics.com>', 
                to: user.email, 
                subject: 'Arbimon II: Account activation',
                html: mailTemplates.activate({
                    fullName: user.firstName + ' ' + user.lastName,
                    username: user.username,
                    email: user.email,
                    hash: hash
                })
            };
            
            transport.sendMail(mailOptions, function(error, info){
                if(error){
                    debug('sendmail error', error);
                    model.users.removeRequest(requestId, function(err, info) {
                        if(err)  return next(err);
                        
                        res.status(500).json({ error: "Could not send confirmation email." });
                    });
                    return;
                }
                
                debug('email sent to:', user.email);
                res.json({ success: true });
                callback(null);
            });
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
    res.render('forgot-request');
});

router.post('/forgot_request', function(req, res, next) {
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
            from: 'Sieve-Analytics <support@sieve-analytics.com>', 
            to: user.email, 
            subject: 'Arbimon II: Password reset',
            html: mailTemplates.resetPass({
                fullName: user.firstname + ' ' + user.lastname,
                username: user.login,
                hash: hash
            })
        };
        
        transport.sendMail(mailOptions, function(error, info){
            if(error) return next(error);
            
            model.users.newPasswordResetRequest(user.user_id, hash, function(err, results) {
                if(err) return next(err);
                
                res.json({ success: true });
            });
            
        });
    });
});


router.get('/reset_password/:hash', function(req, res, next) {
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
