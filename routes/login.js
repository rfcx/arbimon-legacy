var express = require('express');
var router = express.Router();
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});


passport.use(new LocalStrategy(
    function(username, password, done) {
        
        // hardcoded for testing needs database 
        if( username !== "user") {
            return done(null, false, { message: "bad credentials" });
        }
        else {
            if(password !== "1234") {
                return done(null, false, { message: "wrong password" });
            }
            else {
                return done(null, { user: username, timestamp: new Date() });
            }
            
        }
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
    
