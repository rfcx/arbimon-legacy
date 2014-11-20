
module.exports = function(grunt) {
     grunt.initConfig({
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
            }
        },

        concat: {
            dev: {
                src: [   // add project javascript files here
                    'assets/js/router.js',
                    'assets/js/visualizer/*.js',
                    'assets/js/dashboard.js',
                    'assets/js/audiodata.js',
                    'assets/js/a2services.js',
                    'assets/js/a2utils.js',
                    'assets/js/extras/*.js',
                    'assets/js/a2directives.js',
                    'assets/js/models.js',
                    'assets/js/classification.js',
                    'assets/js/jobs.js',
                    'assets/js/user-settings.js',
                    'assets/js/home.js',
                    'assets/js/admin.js',
                ], 

                dest: 'public/assets/js/arbimon2.js'
            }
        },

        watch: {
            options: {
                //reloads the browser with livereload plugin
                livereload: true
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
        },

        express: {
            dev: {
                options: {
                    script: 'bin/www'
                }
            }
        },
        
        clean: {
            assets: ['public/assets/*'],
            packages: ['bower_components', 'node_modules']
        }
    });

    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-express-server');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-html2js');

    grunt.registerTask('build', ['copy', 'less', 'html2js', 'concat']);
    grunt.registerTask('default', ['build']);
    grunt.registerTask('server', ['build', 'express:dev', 'watch']);
};
