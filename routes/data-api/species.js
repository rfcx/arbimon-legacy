var express = require('express');
var router = express.Router();
var model = require('../../model');

router.get('/list/:limit', function(req, res, next) {
    var limit = Number(req.param('limit'));

    model.species.list(limit, function(err, rows) {
        if(err)
            next(err);

        res.json(rows);
    });
});

router.get('/search/:query', function(req, res, next) {
    var query = req.param('query');

    model.species.search(query, function(err, rows){
        if(err)
            next(err);

        res.json(rows);
    });
});

router.param('speciesId', function(req, res, next, species_id){
    model.species.findById(species_id, function(err, rows) {
        if(err){
            return next(err);
        }

        if(!rows.length){
            return res.status(404).json({ error: "species not found"});
        }

        req.species = rows[0];
        return next();
    });
});

router.get('/:speciesId', function(req, res, next) {
    res.json(req.species);
});

module.exports = router;
