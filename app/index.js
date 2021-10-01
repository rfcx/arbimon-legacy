/* jshint node:true */
"use strict";

// native packages
var path = require('path');

// packages 3rd party
var express = require('express');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var SessionStore = require('express-mysql-session')(session);
var busboy = require('connect-busboy');
var AWS = require('aws-sdk');
var jwt = require('express-jwt');
var paypal = require('paypal-rest-sdk');
const db = require('./utils/dbpool');
const pool = db.getPool();
var config = require('./config');
AWS.config.update({
    accessKeyId: config('aws').accessKeyId,
    secretAccessKey: config('aws').secretAccessKey,
    region: config('aws').region
});

var systemSettings = require('./utils/settings-monitor');
var tmpfilecache = require('./utils/tmpfilecache');
var APIError = require('./utils/apierror');
var model = require('./model');
var uploadQueue = require('./utils/upload-queue');

var www_root_path = path.resolve(__dirname, '..', 'public');

paypal.configure(config('paypal'));
var app = express();

app.appRootPath = path.resolve(path.join(__dirname, '..'));

// app settings
// -----------------------------------------------------------------

app.disable('x-powered-by');

// view engine setup
app.set('views', path.resolve(__dirname, 'views'));
app.set('view engine', 'ejs');

if (app.get('env') === 'production') {
    app.enable('trust proxy');
}

if (app.get('env') === 'development') {
    require('q').longStackSupport = true;
}

// middleware
// ------------------------------------------------------------------

logger.token('tag', function(req, res){ return 'arbimon2:request'; });

app.use(logger(
    app.get('env') === 'production' ?
    ':date[clf] :tag :remote-addr :method :url :status :response-time ms - :res[content-length] ":user-agent"' :
    'dev', {
    skip: function(req, res){
        return /\/jobs\/progress/.test(req.originalUrl);
    }
}));


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

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({
    extended: false,
    limit: '50mb'
}));

app.use(express.static(www_root_path));
if(app.get('env') === 'development') {
    app.use('/docs', express.static(path.join(__dirname, 'docs')));
}

var sessionConfig = {
    key    : config('session').key,
    secret : config('session').secret,
    resave : true,
    saveUninitialized : false,
    store: new SessionStore({
        expiration : config('session').expiration
    }, pool)
};

if (app.get('env') === 'production') {
    sessionConfig.cookie = { secure: true }; // use secure cookies
}

app.use(session(sessionConfig));
app.use(systemSettings.middleware());

// routes ----------------------------------------------

var routes = require('./routes/index');
var admin = require('./routes/admin');


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
    if('string' === typeof err){
        err = new Error(err);
    }
    res.status(err.status || 500);

    // json APIs have more error-handling possibilities
    if (/application\/json/.test(res.getHeader('Content-Type'))) {
        if(err instanceof APIError){
            res.json(err.message);
        } else {
            console.error(err.stack);
            res.json('Server error');
        }
    } else {
        console.error(err.stack);
        if(app.get('env') === 'development') {
            res.render('error', {
                message: err.message,
                error: err,
                user: req.session ? req.session.user : undefined
            });
        }
        else {
            res.render('error', {
                message: err.message || "Something went wrong",
                error: {},
                user: req.session.user
            });
        }
    }
});

app.start = function(){
    tmpfilecache.cleanup();
    if(config("upload-queue").enabled){
        uploadQueue.resume();
    }
};

module.exports = app;
