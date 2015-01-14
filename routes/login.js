var debug = require('debug')('arbimon2:route:login');
var express = require('express');
var router = express.Router();
var model = require('../model/');
var sha256 = require('../utils/sha256');
var gravatar = require('gravatar');
var mysql = require('mysql');

var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
var transport = nodemailer.createTransport(smtpTransport({
    host: 'smtp.sieve-analytics.com',
    port: 587,
    auth: {
        user: 'support',
        pass: '6k9=qZzy8m58B2Y'
    }
}));

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

router.get('/login', function(req, res) {
    if(req.session) { 
        if(req.session.loggedIn) return res.redirect('/home'); 
    }   
    res.render('login', { message: '' });
});
                                                        
router.post('/login', function(req, res, next) {
    var username = req.body.username;
    var password = req.body.password;
    
    model.users.findByUsername(username, function(err, rows) {
        if(err) return next(err);
        
        if(!rows.length) {
            return res.render('login', { message: "bad credentials" });
        }
        
        user = rows[0];
        
        if(sha256(password) !== user.password) {
            return res.render('login', { message: "wrong password" });
        }
        
        model.users.update({ 
            user_id: user.user_id,
            last_login: new Date()
        }, 
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
        
    });
});

router.get('/logout', function(req, res, next) {
    req.session.destroy(function(err) {
        if(err) return next(err);
        
        res.redirect('/login');
    });
});

router.get('/register', function(req, res) {
    res.render('register', {
        data: {
            title:'Register',
            message:'',
            first_name:"",
            last_name:'',
            email:'',
            password:'',
            confirm:'',
            username:'',
            emailsent:0
        }
    });
});

router.get('/activate/:hash', function(req, res) {    
    model.users.accountRequestExists(req.params.hash,
        function(err,data)
        {
            if(err) return next(err);

            if (data.length) 
            {
                debug('routerlength',data[0].params); 
                model.users.newUser(data[0].params,
                    function (err,datas)
                    {
                        if(err) return next(err);
                        
                        model.users.removeRequest(data[0].support_request_id, function(error, info){
                             res.render('activate',{ 
                                 data: {
                                    title:'Activate',
                                    login:1,
                                    status:'Your account has been activated.'
                                }
                            });
                        });
                    }
                );
            }
            else
            {
                res.render('activate', {
                    data: {
                        title:'Activate',
                        login:0,
                        status:'A registration entry with your information does not exists. You need to register again.'
                    }
                });
            }
        }
    );
    
});

router.post('/register', function(req, res) {
    var username = mysql.escape(req.body.username ).replace('\'','').replace('\'','');
    var first_name = mysql.escape(req.body.first_name ).replace('\'','').replace('\'','');
    var last_name = mysql.escape(req.body.last_name ).replace('\'','').replace('\'','');
    var email = mysql.escape(req.body.email ).replace('\'','').replace('\'','');
    var password = mysql.escape(req.body.password ).replace('\'','').replace('\'','');
    var confirm = mysql.escape(req.body.password_confirmation ).replace('\'','').replace('\'','');
    var newsletter = false;
    if (req.body.newsletter && req.body.newsletter==true)
    {
        newsletter = true;
        //add code to send newsletter
    }
    
    if (password != confirm) {
        return res.render('register', {
            data: {
                title: 'Register',
                message: 'Passwords do not match.',
                first_name: first_name,
                last_name: last_name,
                email: email,
                password: '',
                confirm: '',
                username: '',
                emailsent: 0
            }
        });
    }
    
    model.users.findByUsername(username, function(err, rows) {
        if(err) return next(err);
        
        if (rows.length) {
            return res.render('register', {
                data: {
                    title: 'Register',
                    message: 'Username exists.',
                    first_name: first_name,
                    last_name: last_name,
                    email: email,
                    password: password,
                    confirm: password,
                    username: '',
                    emailsent: 0
                }
            });
        }
            
        model.users.findByEmail(email, function(err, rowsemail) {
            if(err) return next(err);
            
            if (rowsemail.length) {
                return res.render('register', {
                    data: {
                        title: 'Register',
                        message: 'An account exists with that email.',
                        first_name: first_name,
                        last_name: last_name,
                        email: "",
                        password: password,
                        confirm: password,
                        username: username,
                        emailsent: 0
                    }
                });
            } 

            model.users.accountSupportExistsByEmail(email, function(err, rowsemailsuppoert) {
                if(err) return next(err);
               
                if (rowsemailsuppoert.length) {
                    return res.render('register', {
                        data: {
                            title: 'Register',
                            message: 'An email with an activation link has been already sent to your email.',
                            first_name: first_name,
                            last_name: last_name,
                            email: "",
                            password: password,
                            confirm: password,
                            username: username,
                            emailsent: 0
                        }
                    });
                }
               
                password = sha256(password);
                var seed = Math.ceil(new Date().getTime() / 1000);
                var hash = sha256(seed.toString()+username+first_name+last_name+email);
                var submitData = {
                    username: username,
                    first_name: first_name,
                    last_name: last_name,
                    email: email,
                    password: password
                };
                
                debug('submitData',submitData);
                
                model.users.newAccountRequest(submitData, hash, function(err, rowsRes) {
                    if(err) return next(err);
                        debug('rowsRes',rowsRes);
                        
                        var requestId = rowsRes.insertId;
                        var mailOptions = {
                            from: 'Sieve-Analytics <support@sieve-analytics.com>', 
                            to: email, 
                            subject: 'Sieve-Analytics: Arbimon Account Activation', // Subject line
                            html: 'Your Arbimon account for <b>'+username+'</b> is almost ready to use!<br>'+
                                '<br>'+
                                'Follow this link to activate your account:<br><br>'+
                                'https://arbimon.sieve-analytics.com/activate/'+hash
                        };
                        
                        transport.sendMail(mailOptions, function(error, info){
                            if(error){
                                debug('sendmail error', error);
                                model.users.removeRequest(requestId, function(error, info) {
                                    
                                    return res.render('register', {
                                        data: {
                                            title: 'Register',
                                            message: 'Could not send activation email.',
                                            first_name: first_name,
                                            last_name: '',
                                            email: email,
                                            password: '',
                                            confirm: '',
                                            username: '',
                                            emailsent: 0
                                        }
                                    });
                                });
                            }
                            else{
                                debug('email sent to:',email);
                                return res.render('register', {
                                    data: {
                                        title: 'Register',
                                        message: '',
                                        first_name: first_name,
                                        last_name: '',
                                        email: email,
                                        password: '',
                                        confirm: '',
                                        username: '',
                                        emailsent: 1
                                    }
                                });
                            }
                        });
                    }
                );
            });
        });
    });
    
});

module.exports = router;

    
