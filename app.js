/* jshint node:true */
"use strict";

// native packages
var path = require('path');

// packages 3rd party
var express = require('express');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var SessionStore = require('express-mysql-session');
var busboy = require('connect-busboy');
var AWS = require('aws-sdk');
var jwt = require('express-jwt');
var paypal = require('paypal-rest-sdk');


var config = require('./config');
AWS.config.update({
    accessKeyId: config('aws').accessKeyId, 
    secretAccessKey: config('aws').secretAccessKey,
    region: config('aws').region
});

var systemSettings = require('./utils/settings-monitor');
var tmpfilecache = require('./utils/tmpfilecache');
var model = require('./model');

paypal.configure(config('paypal'));
var app = express();


// app settings
// -----------------------------------------------------------------

app.disable('x-powered-by');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

if (app.get('env') === 'production') {
    app.enable('trust proxy');
}

// middleware
// ------------------------------------------------------------------


app.use(favicon(path.join(__dirname, '/public/images/favicon.ico')));

logger.token('tag', function(req, res){ return 'arbimon2:request'; });

if(app.get('env') === 'production') {
    app.use(logger(':date[clf] :tag :remote-addr :method :url :status :response-time ms - :res[content-length] ":user-agent"'));
} else {
    app.use(logger('dev'));
}

app.use(function(req, res, next) {
    if(req.app.get('env') === 'production') {
        req.appHost = req.protocol +"://" + req.hostname;
    }
    else {
        req.appHost = req.protocol +"://" + req.hostname + ':' + req.app.get('app-port');
    }
    next();
});

app.use(jwt({ 
    secret: config('tokens').secret,
    userProperty: 'token',
    credentialsRequired: false
}));

app.use(cookieParser());
app.use(busboy({
    limits: {
        fileSize: 1073741824, // 1GB
    }
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
if(app.get('env') === 'development') {
    app.use('/docs', express.static(path.join(__dirname, 'docs')));
}

var sessionConfig = {
    key    : config('session').key,
    secret : config('session').secret,
    resave : true,
    saveUninitialized : false,
    store: new SessionStore({
        host     : config('db').host,
        user     : config('db').user,
        password : config('db').password,
        database : config('db').database
    })
};

if (app.get('env') === 'production') {
    sessionConfig.cookie = { secure: true }; // use secure cookies
}

app.use(session(sessionConfig));
app.use(systemSettings.middleware());

// routes ----------------------------------------------

var routes = require('./routes/index');
var admin = require('./routes/admin');

app.get('/alive', function(req, res) { // for health checks
    res.sendStatus(200);
});

app.use('/admin', admin);

app.use(function(req, res, next) {
    if(req.systemSettings('maintenance_mode') == 'on')
        return res.status(301).render('maintenance');
    
    next();
});

app.use('/', routes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    res.status(404).render('not-found');
});

// error handler
app.use(function(err, req, res, next) {
    console.error(err.stack);
    
    res.status(err.status || 500);
    if(app.get('env') === 'development') {
        res.render('error', {
            message: err.message,
            error: err
        });
    }
    else {
        res.render('error', {
            message: "Something went wrong",
            error: {}
        });
    }
});

app.start = function(){
    tmpfilecache.cleanup();
};

module.exports = app;
