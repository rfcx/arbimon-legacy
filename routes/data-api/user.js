var express = require('express');
var router = express.Router();
var model = require('../../models');

router.get('/projectlist', function(req, res, next) {
    model.users.projectList(req.session.user.id, function(err, rows) {
        if(err) return next(err);
        
        res.json(rows);
    });
});

router.get('/feed', function(req, res) {
    res.status(200).end();
});

module.exports = router;