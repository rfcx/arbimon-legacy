var concat = require('gulp-concat');
var gulp = require('gulp');
var uglify = require('gulp-uglify');
var livereload = require('gulp-livereload');
var less = require('gulp-less');
var gzip = require('gulp-gzip');
var ngAnnotate = require('gulp-ng-annotate');
var rename = require('gulp-rename');
var sourcemaps = require('gulp-sourcemaps');
var templateCache = require('gulp-angular-templatecache');
var pump = require('pump');
var childProcess = require('child_process');

var app={
    server: {
        bin: './bin/www',
        src: './app/**/*',
    },
    code:{
        name: 'arbimon2.js',
        src: './assets/app/**/*.js',
        dest: './public/assets/js/',
    },
    templates: {
        name:'arbimon2-templates.js',
        module: 'templates-arbimon2',
        src: './assets/app/**/*.html',
        dest: './public/assets/js/',
    },
    less: {
        name:'style.css',
        watch:'./assets/less/**/*.less',
        src: [
            './assets/less/bootstrap.less',
            './assets/less/style.less'
        ],
        dest: './public/assets/css/',
    },
};

gulp.task('default', ['app:code', 'app:templates', 'app:less']);

gulp.task('watch', ['livereload', 'app:server', 'app:watch']);

gulp.task('livereload', function(){
    livereload.listen();
});

gulp.task('app:watch', function(){
    gulp.watch(app.code.src, ['app:code']);
    gulp.watch(app.templates.src, ['app:templates']);
    gulp.watch(app.less.watch, ['app:less']);
    gulp.watch(app.server.watch, ['app:server']);
});

gulp.task('app:code', function(done){
    pump([
        gulp.src(app.code.src),
        sourcemaps.init(),
        ngAnnotate(),
        concat(app.code.name),
        // gulp.dest(app.code.dest),
        uglify(),
        rename({suffix:'.min'}),
        sourcemaps.write('.'),
        // gzip(),
        gulp.dest(app.code.dest),
        livereload(),
    ], done);
});

gulp.task('app:templates', function(done){
    pump([
        gulp.src(app.templates.src),
        templateCache({
            filename:app.templates.name,
            module: app.templates.module,
            standalone:true,
            root:'/'
        }),
        // gzip(),
        gulp.dest(app.templates.dest),
        livereload(),
    ], done);
});

gulp.task('app:less', function(done){
    pump([
        gulp.src(app.less.src),
        less({
            filename:app.less.name,
            root:'/'
        }),
        concat(app.less.name),
        // gzip(),
        gulp.dest(app.less.dest),
        livereload(),
    ], done);
});

var server_process;
gulp.task('app:server', function(){
    if(server_process){
        server_process.kill();
    }
    server_process = childProcess.spawn(app.server.bin, [], {
        stdio: 'inherit'
    });
    server_process.on('close', function(code){
        gulp.log("Server exited with code " + code);
    });
});

process.on('exit', function(){
    if(server_process){
        server_process.kill();
    }
});