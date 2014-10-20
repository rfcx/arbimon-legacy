var express = require('express');
var router = express.Router();
var gravatar = require('gravatar');
var model = require('../../models');
var sha256 = require('../../utils/sha256');

router.get('/projectlist', function(req, res, next) {
    model.users.projectList(req.session.user.id, function(err, rows) {
        if(err) return next(err);
        
        res.json(rows);
    });
});

router.get('/feed', function(req, res) {
    res.sendStatus(200);
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
            
            console.log("update user name:", result);
            res.json({ message: "success! Name updated"});
        });
    });
});

module.exports = router;
