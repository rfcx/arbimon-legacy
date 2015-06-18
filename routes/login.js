var debug = require('debug')('arbimon2:route:login');
var express = require('express');
var router = express.Router();
var gravatar = require('gravatar');
var mysql = require('mysql');
var mcapi = require('mailchimp-api');
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var async = require('async');
var validator = require('validator');
var request = require('request');
var ejs = require('ejs');
var fs = require('fs');
var dd = console.log;

var config = require('../config');
var model = require('../model/');
var sha256 = require('../utils/sha256');

var mc = new mcapi.Mailchimp(config('mailchimp').key);

var mailTemplates = {
    activate: ejs.compile(fs.readFileSync('./views/mail/activate-account.ejs').toString()),
    resetPass: ejs.compile(fs.readFileSync('./views/mail/reset-password.ejs').toString())
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

router.use(function(req, res, next) {
    
    req.haveAccess = function(project_id, permission_name) {
        
        if(req.session.user.isSuper === 1)
            return true;
        
        var projectPerms = req.session.user.permissions[project_id];
        console.log(project_id);
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

router.get(['/','/login'], function(req, res) {  
    if(req.session) { 
        if(req.session.loggedIn) return res.redirect('/home'); 
    }
    res.render('login', { message: '' });
});

router.post('/login', function(req, res, next) {
    var username = req.body.username || '';
    var password = req.body.password || '';
    var captchaResponse = req.body.captcha;

    var redirectUrl = req.query.redirect || '/home';
    var permitedRetries = 10;
    var captchaRequired = 3;
    var waitTime = 3600000; // miliseconds
    var now = new Date();
    
    async.auto({
        //find ip invalid login tries
        invalidLogins: function(callback) {
            model.users.invalidLogins(req.ip, callback);
        },
        //find user
        findUser: function(callback) {
            model.users.findByUsername(username, callback);
        },
        // verify if user not exceeded max retries
        checkRetries: ['invalidLogins', 'findUser', function(callback, results) {
            
            var invalidLogins = results.invalidLogins[0][0];
            var user = !results.findUser.length ? null : results.findUser[0][0];
            
            var tries;
            
            if(!user) {
                tries = invalidLogins.tries;
            }
            else {
                tries = Math.max(invalidLogins.tries, user.login_tries);
            }
            
            debug('login tries:', tries);
            
            if(user && (user.disabled_until === '0000-00-00 00:00:00') ){
                return res.json({ error: "This account had been disabled" });
            }
            
            if(tries >=  permitedRetries || (user && (user.disabled_until > now) ) ) {
                // TODO:: esto dice una hora pero no necesariamente es una, o si?
                return res.json({ error: "Too many tries, try again in 1 hour. If you think this is wrong contact us." });
            }
            
            callback(null, { tries: tries, user: user });
        }],
        // check captcha if needed
        verifyCaptcha: ['checkRetries', function(callback, results) {
            
            if(results.checkRetries.tries >= captchaRequired) {
                request({ 
                    uri:'https://www.google.com/recaptcha/api/siteverify',
                    qs: {
                        secret: config('recaptcha').secret,
                        response: captchaResponse,
                        remoteip: req.ip,
                    }
                }, function(error, response, body) { 
                    if(error) {
                        return callback(error);
                    }
                    
                    body = JSON.parse(body);
                    
                    debug('captcha validation:\n', body);
                    
                    callback(null, body.success);
                });
            }
            else {
                callback(null, true);
            }
        }]
            
            
    },
    function(err, results) {
        if(err) return next(err);
        
        var user = results.checkRetries.user;
        var tries = results.checkRetries.tries;
        var response = {};
        var reason = '';
        
        if(!results.verifyCaptcha) {
            response.error = "Error validating captcha";
            reason = 'invalid_captcha';
        }
        else if(!user) {
            response.error = "Invalid username or password";
            reason = 'invalid_username';
            
        }
        else if(sha256(password) !== user.password){
            response.error = "Invalid username or password";
            reason = 'invalid_password';
        }
        else {
            
            // update user info
            model.users.update({ 
                user_id: user.user_id,
                last_login: new Date(),
                login_tries: 0
            }, 
            function(err, rows) {
                if(err) console.error(err);
            });
            
            // set session
            req.session.loggedIn = true; 
            req.session.user = {
                id: user.user_id,
                username: user.login,
                email: user.email,
                firstname: user.firstname,
                lastname: user.lastname,
                isSuper: user.is_super,
                imageUrl: gravatar.url(user.email, { d: 'monsterid', s: 60 }, https=req.secure),
                projectLimit: user.project_limit
            };
            
            response.success = true;
            response.redirect = redirectUrl;
        }
        
        if(response.error) {
            
            now.setHours(now.getHours() + 1);
            
            if(user) {
                var userInfo;
                if(tries+1 >= permitedRetries) {
                    userInfo = { 
                        user_id: user.user_id,
                        login_tries: 0,
                        disabled_until: now
                    };
                }
                else {
                    userInfo = { 
                        user_id: user.user_id,
                        login_tries: user.login_tries + 1
                    };
                }
                
                model.users.update(userInfo, function(err, rows) {
                    if(err) console.error(err);
                });
            }
            
            model.users.loginTry(req.ip, username, reason, function(err, rows) {
                if(err) console.error(err);
            });
            
            response.captchaNeeded = (tries + 1) >= captchaRequired;
        }
        
        res.json(response);
    });
});

router.get('/logout', function(req, res, next) {
    req.session.destroy(function(err) {
        if(err) return next(err);
        
        res.redirect('/login');
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
