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


var config = require('../config');
var model = require('../model/');
var sha256 = require('../utils/sha256');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
});

router.use(function(req, res, next) {
    
    req.haveAccess = function(project_id, permission_name) {
        
        if(req.session.user.isSuper === 1)
            return true;
        
        var projectPerms = req.session.user.permissions[project_id];
        
        debug("project permission:", projectPerms);
        
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

router.get('/login', function(req, res) {  
    if(req.session) { 
        if(req.session.loggedIn) return res.redirect('/home'); 
    }
    res.render('login', { message: '' });
});
                                                        
router.post('/login', function(req, res, next) {
    var username = req.body.username;
    var password = req.body.password;
    var permitedRetries = 3;
    var waitTime = 3600000; // miliseconds
    var request_ip = req.ip;
    
    model.users.loginsTries(request_ip, username, function(err, rows) {
        if(err) return next(err);
        var retries = rows.length;
        var last_retry_time = 0;
        for(var i = 0 ; i < retries;i++)
        {
            if (last_retry_time < rows[i].time)
            {
                last_retry_time = rows[i].time;
            }
        }
        var d = new Date();
        var n = d.getTime();
        var can_try_login = true;
        if (retries >= permitedRetries)
        {
            if ((n-last_retry_time)< waitTime)
            {
                can_try_login  = false;
            }
            else
            {
                model.users.removeLoginTries(
                request_ip, 
                function(err, rows) {
                    if(err) return next(err);                     
                });    
            }
        }
        
        if(can_try_login)
        {
            model.users.findByUsername(username, function(err, rows) {
                if(err) return next(err);
                var d = new Date();
                var n = d.getTime();              
                if(!rows.length)
                {
                    model.users.loginTry(request_ip,n,username,'invalid user', function(err, rows) {
                        if(err) return next(err);
                        return res.render('login', { message: "Invalid user" });
                    });
                }
                else
                {          
                    user = rows[0];
                    
                    if(sha256(password) !== user.password) {
                        
                        model.users.loginTry(request_ip,n,username,'invalid_password', function(err, rows) {
                            if(err) return next(err);
                            return res.render('login', { message: "Wrong password" });
                        });
                    }
                    else
                    {
                        model.users.update({ 
                            user_id: user.user_id,
                            last_login: new Date()
                        }, 
                        function(err, rows) {
                            if(err) return next(err);
                        });

                        model.users.removeLoginTries( 
                        request_ip , 
                        function(err, rows) {
                            if(err) return next(err);
                        });
                        
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
                        
                        res.redirect('/home');
                    }
                }
            });
        }
        else
        {
            return res.render('login', { message: "too many tries. login disabled for one hour." });
        }
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

        if(!data.length) 
        {
            res.render('activate', {
                login: false,
                status: 'A registration entry with your information does not exists. You need to register again.'
            });
            
            return;
        }
        
        var userInfo = JSON.parse(data[0].params);
        
        debug('Activate user', userInfo);
        
        model.users.insert(userInfo, function (err,datas) {
                if(err) return next(err);
                
                res.render('activate',{
                    login: true,
                    status:'<b>'+userInfo.login+'</b> your account has been activated.'
                });
                
                model.users.removeRequest(data[0].support_request_id, function(error, info){
                     if(err) return next(err);
                     
                });
            }
        );
        
        
    });
    
});

router.post('/register', function(req, res, next) {
    // console.log(req.body);
    
    var user = req.body.user;
    var captchaResponse = req.body.captcha;
    var subscribeToNewsletter = req.body.newsletter;
    
    if(!user || !captchaResponse) {
        return res.status(400).json({ error: "missing paramenters" });
    }
    
    async.waterfall([
        // validate userInfo
        function(callback) {
            var userInfoIsValid = (
                validator.isAlphanumeric(user.firstName) &&
                validator.isAlphanumeric(user.lastName) &&
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
            if(error) return next(err);
            
            model.users.newPasswordResetRequest(user.user_id, hash, function(err, results) {
                if(err) return next(err);
                
                res.json({ success: true });
            });
            
        });
    });
});


router.get('/reset_password/:hash', function(req, res, next) {
    
    model.users.findAccountSupportReq(req.params.hash, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) return res.status(404).render('not-found');
        
        res.render('reset-password');
    });
});

router.post('/reset_password/:hash', function(req, res, next) {
    model.users.findAccountSupportReq(req.params.hash, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) return res.status(404).render('not-found');
        
        model.users.update({
            user_id: rows[0].user_id,
            password: sha256(req.body.password),
        },
        function(err, results) {
            if(err) return next(err);
            
            res.json({ success: true });
            
            model.users.removeRequest(rows[0].support_request_id, function(err, results) {
                if(err) return next(err);
            });
        });
    });
});

module.exports = router;
