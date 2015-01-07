
module.exports = function(grunt) {
    var initcfg = {
        pkg: grunt.file.readJSON('package.json'),
        less: {
            main: {
                files: {
                    "public/assets/css/style.css" : "assets/less/style.less",
                }
            },

            bootstrap: {
                options: {
                    compress: true,
                },
                files: {
                    "public/assets/bootstrap/css/bootstrap.min.css": "assets/less/bootstrap.less"
                }
            }
        },
        html2js: {
            options: {
                base : 'assets',
                rename: function (moduleName) {
                    return '/' + moduleName;
                }
            },
            arbimon2: {
                src: [
                    'assets/partials/**/*.html'
                ],
                dest: 'public/assets/js/arbimon2-templates.js'
            },
        },
        ngdocs: { // angular code documentation
            options:{
                dest:'docs/front-end',
                html5Mode: false
            },
            all:['assets/js/**/*.js'],
        },
        copy: {
            bootstrap: {
                expand: true,
                cwd: 'bower_components/bootstrap/dist/',
                src: ['fonts/*', 'js/*'],
                dest: 'public/assets/bootstrap/',
            },

            jquery: {
                expand: true,
                flatten: true,
                src: 'bower_components/jquery/dist/*',
                dest: 'public/assets/jquery/',
            },
            
            jqueryUi: {
                expand: true,
                flatten: true,
                src: 'bower_components/jquery-ui/jquery-ui.min.js',
                dest: 'public/assets/jquery/',
            },
            
            fontAwesome: {
                expand: true,
                cwd: 'bower_components/font-awesome/',
                src: ['css/*', 'fonts/*'],
                dest: 'public/assets/font-awesome/',
            },

            d3: {
                expand: true,
                flatten: true,
                src: 'bower_components/d3/*.js',
                dest: 'public/assets/d3/'
            },
            ngTable: {
                expand: true, 
                cwd: 'bower_components/ng-table/',
                src: ['ng-table.min.js', 'ng-table.min.css'],
                dest: 'public/assets/ng-table/',
            },           

            angular: {
                expand: true,
                flatten: true,
                src: 'bower_components/angular/*',
                dest: 'public/assets/angular/'
            },

            angularAudio: {
                expand: true,
                flatten: true,
                src: 'bower_components/angular-audio/app/angular.audio.js',
                dest: 'public/assets/angular-audio/'
            },

            angularBootstrap: {
                expand: true,
                flatten: true,
                src: 'bower_components/angular-bootstrap/*',
                dest: 'public/assets/angular-bootstrap/'
            },

            angularUiRouter: {
                expand: true,
                flatten: true,
                src: 'bower_components/angular-ui-router/release/*',
                dest: 'public/assets/angular-ui-router/'
            },

            angularUiRouterExtras: {
                expand: true,
                flatten: true,
                src: 'bower_components/ui-router-extras/release/ct-ui-router-extras.min.js',
                dest: 'public/assets/ui-router-extras/'
            },
            
            angularUiSelect: {
                expand: true,
                flatten: true,
                src: 'bower_components/angular-ui-select/dist/select.min*',
                dest: 'public/assets/angular-ui-select/'
            },
            
            angularUiSelectSelectizeTheme: {
                expand: true,
                flatten: true,
                src: 'bower_components/selectize/dist/css/selectize.default.css',
                dest: 'public/assets/angular-ui-select/'
            },
            angularRangeSlider: {
                expand: true,
                cwd: 'bower_components/angular-rangeslider/',
                src: ['angular.rangeSlider.js', 'angular.rangeSlider.css'],
                dest: 'public/assets/angular-range-slider/'
            },
            moment: {
                expand: true,
                flatten: true,
                src: 'bower_components/moment/min/moment.min.js',
                dest: 'public/assets/moment/'
            },

            angularFileUpload: {
                expand: true,
                flatten: true,
                src: 'bower_components/angular-file-upload/**/*.js',
                dest: 'public/assets/angular-file-upload/'
            },
            
            humanejs: {
                expand: true,
                flatten: true,
                cwd: 'bower_components/humane-js/',
                src: ['humane.min.js', 'themes/libnotify.css'],
                dest: 'public/assets/humane-js/'
            },
            
            ngCsv : { 
                expand: true,
                flatten: true,
                src: 'bower_components/ng-csv/build/ng-csv.min.js',
                dest: 'public/assets/ng-csv/'             
            },
            
            angularSanitize : {
                expand: true,
                flatten: true,
                src: 'bower_components/angular-sanitize/angular-sanitize.min.js',
                dest: 'public/assets/angular-sanitize/'               
            },
            
            angularytics : {
               expand: true,
               flatten: true,
               src: 'bower_components/angularytics/dist/angularytics.min.js',
               dest: 'public/assets/angularytics/'           
            }
        },

        concat: {
            dev: {
                src: [
                    'assets/js/**/*.js'
                ], 

                dest: 'public/assets/js/arbimon2.js'
            }
        },

        watch: {
            options: {                
                livereload: true //reloads the browser with livereload plugin
            },
            html: {
                files: [
                    'views/**/*.ejs'
                ],
                tasks:[]
            },
            less: {
                files: ['assets/less/**/*.less'],
                tasks: ['less']
            },
            frontendjs: {
                files: [
                    'assets/js/*.js',
                    'assets/js/**/*.js'
                ],
                tasks: ['concat:dev']
            },
            html2js: {
                files: [
                    'assets/partials/**/*.html'
                ],
                tasks: ['html2js']
            },
            backendjs: {
                files: [
                    'app.js',
                    'routes/**/*.js',
                    'models/**/*.js',
                    'utils/**/*.js',
                    'config/**/*.js',
                    'config/**/*.json'
                ],
                tasks: ['express:dev'],
                options: {
                    spawn: false // for grunt-contrib-watch v0.5.0+
                }
            },
            jobqueue: {
                files: [
                    'jobqueue-app.js',
                    'models/job_queues.js',
                    'utils/**/*.js',
                    'config/**/*.js',
                    'config/**/*.json'
                ],
                tasks: ['express:jobqueue'],
                options: {
                    spawn: false // for grunt-contrib-watch v0.5.0+
                }
            },
        },

        express: {
            dev: {
                options: {
                    script: 'bin/www'
                }
            },
            jobqueue: {
                options: {
                    script: 'bin/jobqueue'
                }
            }
        },
        
        clean: {
            assets: ['public/assets/*'],
            packages: ['bower_components', 'node_modules']
        }
    };
    
    var appserver  = grunt.cli.tasks.indexOf('server') >= 0;
    var jobqserver = grunt.cli.tasks.indexOf('jobqueue-server') >= 0;
    if(!jobqserver){
        delete initcfg.watch.jobqueue;
    } else if(!appserver){
        initcfg.watch.options.livereload = false;
    }
    
    grunt.initConfig(initcfg);

    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-express-server');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-html2js');
    grunt.loadNpmTasks('grunt-ngdocs');
    
    grunt.registerTask('build', ['copy', 'less', 'html2js', 'concat']);
    grunt.registerTask('default', ['build']);
    grunt.registerTask('server', ['build', 'express:dev', 'watch']);
    grunt.registerTask('jobqueue-server', ['express:jobqueue', 'watch:jobqueue']);
    grunt.registerTask('docs', ['ngdocs']);
};
