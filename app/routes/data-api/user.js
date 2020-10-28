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
    var type = req.query.type
    // super user list all projects
    if (type && type === 'my') {
        model.projects.find({ owner_id: req.session.user.id }, function(err, rows) {
            if(err) return next(err);

            res.json(rows);
        });
    }
    else if(req.session.user.isSuper === 1) {
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
    var password = req.body.password || '';

    model.users.findById(req.session.user.id).get(0).then(function(user){
        if(model.users.hashPassword(password) != user.password){
            throw new APIError({ error: "Invalid confirmation password" }, 200);
        }

        if(userData){
            var updateData = {
                user_id: req.session.user.id,
                firstname: userData.name,
                lastname: userData.lastname
            };
            if(userData.password){
                updateData.password = userData.password;
            }
            if(userData.oauth){
                updateData.oauth_google = userData.oauth.google;
                updateData.oauth_facebook = userData.oauth.facebook;
            }

            return model.users.update(updateData);
        }

    }).then(function(){
        return model.users.findById(req.session.user.id).get(0);
    }).then(function(updatedUser){
        req.session.user = model.users.makeUserObject(updatedUser, {secure: req.secure});
        debug("updated data for user:", updatedUser.login);
        res.json({ message: "User data updated."});
    }).catch(next);
});

router.get('/address', function(req, res, next) {
    res.type('json');
    model.users.getAddress(req.session.user.id, function(err, rows) {
        if(err) return next(err);

        if(!rows.length) return res.json({ address: false });

        res.json({ address: rows[0] });
    });
});

router.put('/address', function(req, res, next) {
    res.type('json');
    if(!req.body.address) {
        return res.status(400).json({ error: "missing parameters" });
    }

    var address = req.body.address;
    address.user_id = req.session.user.id;

    model.users.updateAddress(address, function(err, result) {
        if(err) return next(err);

        res.json({ address_update: true });
    });
});

module.exports = router;
