var app = require('express')();

var acmeChallenge = require('../routes/acme-challenge');

app.enable('trust proxy');

app.use('/', acmeChallenge);

app.use(function(req, res, next){
    return res.redirect(301, 'https://' + req.hostname + req.originalUrl);
});

module.exports = app;
