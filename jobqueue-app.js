// packages
var express = require('express');
var logger = require('morgan');

var config = require('./config');
var model = require('./models');
var jobQueue = require('./utils/jobqueue');
var bodyParser = require('body-parser');

// routes
var app = express();

logger.token('tag', function(req, res){ return 'arbimon2:request'; });    
app.use(logger(':date[clf] :tag :remote-addr :method :url :status :response-time ms - :res[content-length] ":user-agent"'));

// APP Routing
app.get('/list', function(req, res, next){
    res.json(jobQueue);
});

app.post('/notify', function(req, res, next){
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    res.status(404).json({http:404, error:'not-found'});
});

// development error handler
app.use(app.get('env') === 'development' ? 
    function(err, req, res, next) {
        console.log("- ERROR : ", err.message);
        console.log(err.status);
        console.log(err.stack);
        res.status(err.status || 500);
        res.json({
            error  : err.message,
            status : err.status,
            stack  : err.stack
        });
    } :
    function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {error: err.message});
    }
);




module.exports = app;
