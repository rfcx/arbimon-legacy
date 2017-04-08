var express = require('express');
var router = express.Router();
var model = require('../../model');

router.get('/all', function(req, res, next) {
    res.type('json');
    model.songtypes.listAll(function(err, rows) {
        if(err)
            next(err);

        res.json(rows);
    });
});


router.param('songtypeId', function(req, res, next, songtype_id){
    model.songtypes.findById(songtype_id, function(err, rows) {
        if(err){
            return next(err);
        }

        if(!rows.length){
            return res.status(404).json({ error: "songtype not found"});
        }

        req.songtype = rows[0];
        return next();
    });
});

router.get('/:songtypeId', function(req, res, next) {
    res.type('json');
    res.json(req.songtype);
});

module.exports = router;
