var debug = require('debug')('arbimon2:route:user');
var express = require('express');
var router = express.Router();
var gravatar = require('gravatar');
var async = require('async');
var sprintf = require("sprintf-js").sprintf;

var model = require('../../model');
var sha256 = require('../../utils/sha256');
var APIError = require('../../utils/apierror');

router.get('/projectlist', function(req, res, next) {
    res.type('json');
    var user = req.session.user;
    var type = req.query.type;
    var includeLocation = req.query.include_location === 'true';
    let publicTemplates = req.query.publicTemplates === 'true';
    if ((user.isAnonymousGuest || user.isSuper !== 1) && !type) {
        model.users.projectList({
            user_id: req.session.user.id,
            publicTemplates: publicTemplates,
            ...req.query.q && { q: req.query.q },
        }, function(err, rows) {
            if(err) return next(err);
            res.json(rows);
        });
    }
    else {
        model.projects.find({
            ...type === 'my' && { user_id: user.id },
            ...includeLocation && { include_location: true },
            publicTemplates: publicTemplates,
            ...req.query.q && { q: req.query.q },
        }, function(err, rows) {
            if(err) return next(err);
            res.json(rows);
        })
    }
});

router.get('/feed/formats', function(req, res, next) {
    res.type('json');
    model.news.getNewsTypeFormats().then(function(newsTypeFormats) {
        res.json(newsTypeFormats.reduce(function(_, format){
            _[format.id] = format.message_format;
            return _;
        }, {}));
    }).catch(next);
});

router.get('/feed/:page', function(req, res, next) {
    res.type('json');

    var page = req.params.page || 0;

    ( (req.session.user.isSuper === 1) ?
        model.news.getFor({page:page, pageCount:10}) :
        model.news.userFeed(req.session.user.id, page)
    ).then(function(news) {
        res.json(news.map(function(newsItem) {
            var data = JSON.parse(newsItem.data);
            data.project = [newsItem.project_id, newsItem.project];
            return {
                type: newsItem.type,
                data: data,
                username: newsItem.username,
                timestamp: newsItem.timestamp,
                imageUrl: gravatar.url(newsItem.email, { d: 'monsterid', s: 30 }, req.secure)
            };
        }));
    }).catch(next);
});

router.get('/info/:userId', function(req, res, next) {
    res.type('json');
    model.users.getInfoForId(req.params.userId).then(function(user) {
        res.json({ user: user[0] });
    }).catch(next);
});

router.get('/info', function(req, res) {
    res.type('json');
    var user = req.session.user;

    res.json({
        username: user.username,
        email: user.email,
        name: user.firstname,
        lastname: user.lastname,
        imageUrl:  user.imageUrl,
        isAnonymousGuest:  user.isAnonymousGuest,
        oauth: user.oauth
    });
});

router.get('/search/:query?', function(req, res, next) {
    res.type('json');
    var query = req.params.query;

    if(!query){
        return res.json({ error: "empty query" });
    }

    model.users.search(query, function(err, rows){
        if(err) return next(err);

        var users = rows.map(function(row){
            row.imageUrl = gravatar.url(row.email, { d: 'monsterid', s: 60 }, req.secure);

            return row;
        });

        res.json(users);
    });
});

router.post('/update/password', function(req, res, next){
    res.type('json');
    var userData = req.body.userData;
    var password = req.body.password;

    if(!userData || !userData.newPass || !password) {
        return res.json({ error: "missing parameters" });
    }

    model.users.findById(req.session.user.id, function(err, user){
        if(err) return next(err);

        if(sha256(password) !== user[0].password)
            return res.json({ error: "invalid password" });

        model.users.update({
            user_id: req.session.user.id,
            password: sha256(userData.newPass)
        },
        function(err, result) {
            if(err) return next(err);

            debug("update user pass:", result);

            res.json({ message: "success! password updated"});
        });
    });
});

router.post('/update', function(req, res, next){
    res.type('json');
    var userData = req.body.userData;

    model.users.findById(req.session.user.id).get(0).then(function(user){
        if(userData){
            var updateData = {
                user_id: req.session.user.id,
                firstname: userData.name,
                lastname: userData.lastname
            };
            if(userData.oauth){
                updateData.oauth_google = userData.oauth.google;
                updateData.oauth_facebook = userData.oauth.facebook;
            }

            return model.users.update(updateData);
        }

    }).then(function(){
        return model.users.findById(req.session.user.id).get(0);
    }).then(function(updatedUser){
        req.session.user = model.users.makeUserObject(updatedUser, {secure: req.secure, all: true});
        debug("updated data for user:", updatedUser.login);
        res.json({ message: "User data updated."});
    }).catch(next);
});

router.post('/invite', function(req, res, next){
    model.users.inviteUser(req.body)
        .then((user) => {
            res.json(user);
        })
        .catch(next);
});

module.exports = router;
