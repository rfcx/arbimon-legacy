let debug = require('debug')('arbimon2:route:user');
let express = require('express');
let router = express.Router();
let gravatar = require('gravatar');

let model = require('../../model');
let sha256 = require('../../utils/sha256');

router.get('/projectlist', function(req, res, next) {
    res.type('json');
    const user = req.session.user;
    const type = req.query.type;
    const includeLocation = req.query.include_location === 'true';
    const publicTemplates = req.query.publicTemplates === 'true';
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


router.get('/info/:userId', function(req, res, next) {
    res.type('json');
    model.users.getInfoForId(req.params.userId).then(function(user) {
        res.json({ user: user[0] });
    }).catch(next);
});

router.get('/info', function(req, res) {
    res.type('json');
    let user = req.session.user;

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
    let query = req.params.query;

    if(!query){
        return res.json({ error: "empty query" });
    }

    model.users.search(query, function(err, rows){
        if(err) return next(err);

        let users = rows.map(function(row){
            row.imageUrl = gravatar.url(row.email, { d: 'monsterid', s: 60 }, req.secure);

            return row;
        });

        res.json(users);
    });
});

router.post('/update/password', function(req, res, next){
    res.type('json');
    let userData = req.body.userData;
    let password = req.body.password;

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
    let userData = req.body.userData;

    model.users.findById(req.session.user.id).get(0).then(function(user){
        if(userData){
            let updateData = {
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
