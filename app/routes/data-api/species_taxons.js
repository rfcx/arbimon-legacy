var express = require('express');
var router = express.Router();
var model = require('../../model');

router.get('/all', function(req, res, next) {
    res.type('json');
    model.speciesTaxons.listAll(function(err, rows) {
        if(err)
            next(err);

        res.json(rows);
    });
});

module.exports = router;
