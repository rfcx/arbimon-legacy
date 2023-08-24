var concat = require('gulp-concat');
var gulp = require('gulp');
var gutil = require('gulp-util');
var uglify = require('gulp-uglify');
var babel = require('gulp-babel');
var livereload = require('gulp-livereload');
var less = require('gulp-less');
var gzip = require('gulp-gzip');
var ngAnnotate = require('gulp-ng-annotate');
var rename = require('gulp-rename');
var ngdocs = require('gulp-ngdocs');
var sourcemaps = require('gulp-sourcemaps');
var templateCache = require('gulp-angular-templatecache');
var pump = require('pump');
var path = require('path');
var rimraf = require('rimraf');
var q = require('q');
var childProcess = require('child_process');

var app={
    server: {
        bin: './bin/www',
        src: './app/**/*',
    },
    dependencies: {
        src: './bower_components',
        dest:'public/includes',
        deps:{
            angular              :{'angular.min.*': '' },
            'angular-bootstrap'  :{'ui-bootstrap-tpls.min.js': '' },
            'angular-file-upload':{'dist/angular-file-upload.min.*': '', },
            'angular-rangeslider':{'angular.rangeSlider.*': '../angular-range-slider/', },
            'angular-sanitize'   :{'angular-sanitize.min.*': '', },
            'angular-ui-router'  :{'release/angular-ui-router.min.js': '' },
            'angular-ui-select'  :{'dist/select.min.*': '', },
            angularytics         :{'dist/angularytics.min.js': '', },
            bootstrap            :{'dist/**' : '', 'dist/fonts/*': '../fonts/'},
            c3                   :{'*': '', },
            d3                   :{'d3.min.js': '', },
            'esri-leaflet'       :{'dist/**': '', },
            'font-awesome'       :{'css/*' : 'css/', 'fonts/*' : 'fonts/', },
            'humane-js'          :{'humane.min.js': '', },
            jquery               :{'dist/jquery.min.*': '', },
            'jquery-ui'          :{'jquery-ui.min.js': '../jquery/', },
            leaflet              :{'dist/**': '', },
            moment               :{'min/moment.min.js': '', },
            'moment-timezone'    :{'builds/moment-timezone-with-data.min.js': '', },
            'ng-csv'             :{'build/ng-csv.min.js': '', },
            'ng-table'           :{'ng-table.*': '', },
            'plotly.js'          :{'dist/plotly.js': '', },
            'qr-js'              :{'qr.min.*': '', },
            'roboto-fontface'    :{'css/*': 'css/', 'fonts/*' : 'fonts/', },
            'selectize'          :{'dist/css/selectize.default.css': '../angular-ui-select/', },
            'ui-router-extras'   :{'release/ct-ui-router-extras.min.js': '' },
            zxcvbn               :{'dist/zxcvbn.*': '', },
        },
    },
    code:{
        name: 'arbimon2.js',
        src: './assets/app/**/*.js',
        dest: './public/includes/js/',
    },
    templates: {
        name:'arbimon2-templates.js',
        module: 'templates-arbimon2',
        src: './assets/app/**/*.html',
        dest: './public/includes/js/',
    },
    less: {
        name:'style.css',
        watch:'./assets/less/**/*.less',
        src: [
            './assets/less/bootstrap.less',
            './assets/less/style.less'
        ],
        dest: './public/includes/css/',
    },
    clean : './public/includes',
};

gulp.task('default', ['build']);

gulp.task('build', ['app:code', 'app:templates', 'app:less', 'app:dependencies']);
gulp.task('watch', ['livereload', 'app:server', 'app:watch']);
gulp.task('build+watch', ['default', 'watch']);

gulp.task('livereload', function(){
    livereload.listen();
});

gulp.task('app:watch', function(){
    gulp.watch(app.code.src, ['app:code']);
    gulp.watch(app.templates.src, ['app:templates']);
    gulp.watch(app.less.watch, ['app:less']);
    gulp.watch(app.server.src, ['app:server']);
});

gulp.task('app:code', function(done){
    pump([
        gulp.src(app.code.src),
        babel({
            plugins: ["@babel/plugin-transform-arrow-functions"]
        }),
        sourcemaps.init(),
        ngAnnotate(),
        concat(app.code.name),
        gulp.dest(app.code.dest),
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

gulp.task('app:clean', function(done){
    rimraf(app.clean, done);
});

gulp.task('app:dependencies', function(done){
    function copy_deps(src, dest, dependencies){
        return q.all(Object.keys(dependencies).map(function(depkey){
            var dep = dependencies[depkey];
            var dsrc = path.join(src, depkey);
            var ddst = path.join(dest, depkey);

            if('object' == typeof dep){
                return copy_deps(dsrc, ddst,  dep);
            } else if('string' == typeof dep){
                ddst = path.join(dest, dep);
                return q.nfcall(pump, [
                    gulp.src(dsrc),
                    gulp.dest(ddst),
                ]).then(function(){
                    gutil.log("Copied " + dsrc + " -> " + ddst);
                });
            }
        }));
    }

    copy_deps(
        app.dependencies.src,
        app.dependencies.dest,
        app.dependencies.deps
    ).nodeify(done);
});

gulp.task('app:ngdocs', function(done){
    pump([
        gulp.src(app.code.src),
        ngdocs.process({
            html5Node: true
        }),
        gulp.dest('./docs/front-end'),
    ], done);
});

var server;
gulp.task('app:server', function(done){
    q.resolve().then(function(){
        if(server){
            gutil.log("Restarting server...");
            server.expectKill = true;
            server.process.kill();
            return server.waitProcessEnd;
        }
    }).then(function(){
        var newServer = {
            process: childProcess.spawn(app.server.bin, [], {
                stdio: 'inherit'
            })
        };
        gutil.log("Starting server process " + gutil.colors.magenta(app.server.bin) + "  (pid: #" + gutil.colors.yellow(newServer.process.pid) + ").");

        newServer.waitProcessEnd = q.Promise(function(resolve, reject){
            newServer.process.on('close', function(code, signal){
                var status =
                ((code !== null) ? " with code " + code : "") +
                (signal ? " due to signal " + signal : "") +
                (newServer.expectKill ? " (expected)" : "")
                ;
                gutil.log("Server process (pid: #" + gutil.colors.yellow(newServer.process.pid) + ") exited" + status + ".");
                resolve({code:code, signal:signal});
            });
            newServer.process.on('error', function(err){
                gutil.log("Error ocurred with server process (pid: #" + gutil.colors.yellow(newServer.process.pid) + ").");
                gutil.error(err);
                reject(err);
            });
        });

        server = newServer;
    }).nodeify(done);
});

process.on('exit', function(){
    if(server){
        server.process.kill();
    }
});
