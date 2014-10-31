// packages
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session')
var SessionStore = require('express-mysql-session');
var busboy = require('connect-busboy');

var config = require('./config');
var model = require('./models');
var tmpfilecache = require('./utils/tmpfilecache');
var jobQueue = require('./utils/jobqueue');

// routes
var login = require('./routes/login');
var routes = require('./routes/index');

var AWS = require('aws-sdk');
AWS.config.loadFromPath('./config/aws.json');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

tmpfilecache.cleanup();

if (app.get('env') === 'production') {
    app.use(function(req, res, next){
        if(!req.secure) {
            var securePort = app.get('tls_port') == 443 ? '' : ':' + app.get('tls_port');
            return res.redirect('https://' + req.hostname + securePort + req.originalUrl)
        }
        next();
    })
}

app.use(favicon(__dirname + '/public/images/favicon.ico'));
app.use(logger('dev'));
app.use(cookieParser());
app.use(busboy());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

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
    app.set('trust proxy', 1) // trust first proxy
    sessionConfig.cookie.secure = true // serve secure cookies
}

app.use(session(sessionConfig));

app.use('/', login);
app.use('/', routes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    res.status(404).render('not-found');
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);

        console.log("- ERROR : ", err.message);
        console.log(err.status);
        console.log(err.stack);
        console.dir(err);

        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;
