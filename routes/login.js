var express = require('express');
var router = express.Router();
var model = require('../models/');
var sha256 = require('../utils/sha256');


router.get('/login', function(req, res) {
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
        else {
            user = rows[0];
            if(sha256(password) !== user.password) {
                return res.render('login', { message: "wrong password" });
            }
            else {
                
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
                    isSuper: user.is_super
                };
                
                res.redirect('/home');
            }
        }
    });
});

router.get('/logout', function(req, res, next) {
    req.session.destroy(function(err) {
        if(err) return next(err);
        
        res.redirect('/login');
    });
});

module.exports = router;

    
