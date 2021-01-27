var http = require('http');
var path = require('path');

var express = require('express');

var app = express();
var rootDir = path.join(__dirname, '../../');

app.disable('x-powered-by');

app.set('views', path.join(rootDir, 'views'));
app.set('view engine', 'ejs');

app.enable('trust proxy');

app.use(express.static(path.join(rootDir, 'public')));

app.get('/alive', function(req, res) { // for health checks
    res.sendStatus(200);
});

app.use(function(req, res) {
    return res.status(301).render('maintenance');
});

app.set('app-port', process.env.APP_PORT || 3000);
app.set('http-redirect-port', process.env.RD_PORT || 3001);

http.createServer(app).listen(app.get('app-port'));
http.createServer(app).listen(app.get('http-redirect-port'));
