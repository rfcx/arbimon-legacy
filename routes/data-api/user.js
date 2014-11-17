var express = require('express');
var router = express.Router();
var gravatar = require('gravatar');
var async = require('async');
var sprintf = require("sprintf-js").sprintf

var model = require('../../models');
var sha256 = require('../../utils/sha256');

router.get('/projectlist', function(req, res, next) {
    
    if(req.session.user.isSuper === 1) {
        model.projects.listAll(function(err, rows) {
            if(err) return next(err);
            
            res.json(rows);
        });
    }
    else {
        model.users.projectList(req.session.user.id, function(err, rows) {
            if(err) return next(err);
            
            res.json(rows);
        });
    }
});

router.get('/feed/:page', function(req, res) {
    
    var page = req.params.page;
    
    async.parallel({
        formats: function(callback) {
            model.news.newsTypesFormat(function(err, rows) {
                if(err) return callback(err);
                
                formats = {};
                
                rows.forEach(function(row){
                    formats[row.id] = row.message_format;
                });
                
                callback(null, formats);
            });
        },
        news: function(callback) {
            model.news.userFeed(req.session.user.id, page, function(err, rows) {
                if(err) return callback(err);
                
                callback(null, rows);
            });
        }
    },
    function(err, results) {
        
        // console.log(results);
        
        var feed = results.news.map(function(row){
            row.image_url = gravatar.url(row.email, { d: 'monsterid', s: 30 }, https=req.secure);
            
            var data = JSON.parse(row.data);
            
            data.project = row.project;
            
            row.message = sprintf(results.formats[row.type], data);
            
            return row;
        });
        
        res.json(feed);
    });
});

router.get('/info', function(req, res) {
    var user = req.session.user;
    res.json({
        username: user.username,
        email: user.email,
        name: user.firstname,
        lastname: user.lastname
    });
});

router.get('/search/:query', function(req, res, next) {
    var query = req.param('query');
    
    if(!query)
        res.json({ error: "empty query" });
    
    model.users.search(query, function(err, rows){
        if(err) return next(err);
        
        var users = rows.map(function(row){
            row.image_url = gravatar.url(row.email, { d: 'monsterid', s: 60 }, https=req.secure);
            
            return row;
        });
        
        res.json(users);
    });
});

router.post('/update/password', function(req, res, next){
    var userData = req.body.userData;
    var password = req.body.password;
    
    model.users.findById(req.session.user.id, function(err, user){
        if(err) return next(err);
        
        if(sha256(password) !== user[0].password)
            return res.json({ error: "invalid password" });
        
        if(userData.newPass1 !== userData.newPass2)
            return res.json({ error: "new passwords don't match" });
        
        model.users.update({
            user_id: req.session.user.id,
            password: sha256(userData.newPass1)
        },
        function(err, result) {
            if(err) return next(err);
            
            console.log("update user pass:", result);
            res.json({ message: "success! password updated"});
        });
    });
});

router.post('/update/name', function(req, res, next){
    var userData = req.body.userData;
    var password = req.body.password;
    
    model.users.findById(req.session.user.id, function(err, user){
        if(err) return next(err);
        
        if(sha256(password) !== user[0].password)
            return res.json({ error: "invalid password" });
        
        model.users.update({
            user_id: req.session.user.id,
            firstname: userData.name,
            lastname: userData.lastname
        },
        function(err, result) {
            if(err) return next(err);
            
            req.session.user.firstname = userData.name;
            req.session.user.lastname = userData.lastname;
            
            console.log("update user name:", result);
            res.json({ message: "success! Name updated"});
        });
    });
});

module.exports = router;
