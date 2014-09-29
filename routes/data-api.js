var express = require('express');
var router = express.Router();
var model = require('../models');

router.get('/user/projectlist', function(req, res) {
    model.users.projectList(req.session.user.id, function(err, rows) {
        if(err) throw err;
        
        res.json(rows);
    });
});

router.get('/user/feed', function(req, res) {
    res.send(200);
});

module.exports = router;
