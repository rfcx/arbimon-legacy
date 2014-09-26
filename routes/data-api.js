var express = require('express');
var router = express.Router();
var model = require('../models');

router.get('/user/projectlist', function(req, res) {
    console.log(req.user.id);
    model.users.projectList(req.user.id, function(err, rows) {
        if(err) throw err;
        
        res.json(rows);
    });
});

router.get('/user/feed', function(req, res) {
    res.send(200);
});

module.exports = router;
