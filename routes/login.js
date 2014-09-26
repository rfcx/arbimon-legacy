var express = require('express');
var router = express.Router();
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var model = require('../models/');
var sha256 = require('../utils/sha256');

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});


passport.use(new LocalStrategy(
    function(username, password, done) {
        
        model.users.findByUsername(username, function(err, rows) {
            if(err) return done(err);
            
            if(!rows.length) {
                return done(null, false, { message: "bad credentials" });
            }
            else {
                user = rows[0];
                if(sha256(password) !== user.password) {
                    return done(null, false, { message: "wrong password" });
                }
                else {
                    
                    model.users.update({ 
                        user_id: user.user_id,
                        last_login: new Date()
                    }, 
                    function(err, rows) {
                        if(err) return done(err);                     
                    });
                
                    return done(null, {
                        id: user.user_id,
                        username: user.login,
                        email: user.email,
                        firstname: user.firstname,
                        lastname: user.lastname,
                        isSuper: user.is_super
                    });
                }
            }
        });
    }
));

module.exports = {
    passport: passport,
    routes: function(passport) {
        router.get('/login', function(req, res) {
            res.render('login', { message: req.flash('error') });
        });
                                                                
        router.post('/login', 
            passport.authenticate('local', { 
                successRedirect: '/',
                failureRedirect: '/login',
                failureFlash: true 
            })
        );

        router.get('/logout', function(req, res) {
            req.logout();
            res.redirect('/login');
        });
        
        return router;
    }
}
    
