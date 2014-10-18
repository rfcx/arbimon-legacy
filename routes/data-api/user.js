var express = require('express');
var router = express.Router();
var gravatar = require('gravatar');
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

module.exports = router;
