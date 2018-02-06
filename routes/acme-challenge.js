/* jshint node:true */
"use strict";

var express = require('express');
var router = express.Router();

var config = require('../config');


router.get('/.well-known/acme-challenge/:challenge', function(req, res) {
    var response = config('acme')[req.params.challenge];
    if(response){
        res.end(response);
    } else {
        next()
    }
});



module.exports = router;
