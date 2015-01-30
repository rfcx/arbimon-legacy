var app = require('express')();

app.enable('trust proxy');

app.use(function(req, res, next){
    return res.redirect(301, 'https://' + req.hostname + req.originalUrl);
});

module.exports = app;
