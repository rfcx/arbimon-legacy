
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
                module: 'templates-arbimon2',
                base : 'assets',
                rename: function (moduleName) {
                    return '/' + moduleName;
                }
            },
            prod: {
                options: {
                    htmlmin: {
                        collapseBooleanAttributes: true,
                        collapseWhitespace: true,
                        removeAttributeQuotes: true,
                        removeComments: true,
                        removeEmptyAttributes: true,
                        removeRedundantAttributes: true,
                        removeScriptTypeAttributes: true,
                        removeStyleLinkTypeAttributes: true
                    }
                },
                src: ['assets/partials/**/*.html'],
                dest: 'public/assets/js/arbimon2-templates.js',
            },
            dev: {
                src: ['assets/partials/**/*.html'],
                dest: 'public/assets/js/arbimon2-templates.js',
            }
        },
        
        // angular code documentation
        ngdocs: { 
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
                src: ['humane.min.js'],
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
            },
            zxcvbn: {
               expand: true,
               flatten: true,
               src: 'bower_components/zxcvbn/zxcvbn.js',
               dest: 'public/assets/zxcvbn/'
            }
        },
        
        concat: {
            dev: {
                src: ['assets/js/**/*.js'], 
                dest: 'public/assets/js/arbimon2.js'
            }
        },
        
        uglify: {
            prod: {
                options: {
                    banner: '/*! <%= pkg.name %> v<%= pkg.version %> '+
                            'build date: <%= grunt.template.today("yyyy-mm-dd") %> | ' +
                            '(c) 2014-2015 Sieve Analytics, Inc. All rights reserved */\n'
                },
                files: [
                    { 
                        src: 'public/assets/js/arbimon2.js', 
                        dest: 'public/assets/js/arbimon2.js' 
                    },
                    { 
                        src: 'public/assets/js/arbimon2-templates.js', 
                        dest: 'public/assets/js/arbimon2-templates.js' 
                    }
                ]
            }
        },
        
        watch: {
            options: {
                livereload: true // reloads the browser with livereload plugin
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
                tasks: ['html2js:dev']
            },
            backendjs: {
                files: [
                    'app.js',
                    'routes/**/*.js',
                    'model/**/*.js',
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
            },
        },
        
        jshint: {
            frontEnd: ['assets/js/**/*.js'],
            backEnd: [
                'Gruntfile.js',
                'bin/www',
                'app.js',
                'config/index.js',
                'routes/**/*.js', 
                'model/**/*.js', 
                'utils/**/*.js',
                'test/**/*.js'
            ]
        },
        
        lesslint: {
            src: ['assets/less/style.less'],
            options: {
                imports: ['assets/less/**/*.less'],
                csslint: {
                    'known-properties': false,
                    'box-model': false,
                    'adjoining-classes': false,
                    'box-sizing': false,
                    'zero-units': false,
                    'outline-none': false,
                    'overqualified-elements': false,
                    'important': false,
                    'font-sizes': false,
                    'compatible-vendor-prefixes': false,
                    'qualified-headings': false,
                    'duplicate-background-images': false,
                    'fallback-colors': false,
                    'regex-selectors': false,
                    'unqualified-attributes': false,
                    'universal-selector': false,
                    'ids': false,
                }
            }
        },
        
        clean: {
            assets: ['public/assets/*'],
            packages: ['bower_components', 'node_modules']
        },
        
        karma: {
            unit: {
                configFile: 'karma.conf.js'
            }
        },
        
        angular_architecture_graph: {
            diagram: {
                files: {
                    "angular-depends": [
                        "assets/js/**/*.js"
                    ]
                }
            }
        }
    };
    
    grunt.initConfig(initcfg);
    
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-express-server');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-html2js');
    grunt.loadNpmTasks('grunt-ngdocs');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks('grunt-angular-architecture-graph');
    grunt.loadNpmTasks('grunt-lesslint');
    
    grunt.registerTask('angular-depends', ['angular_architecture_graph']);
    grunt.registerTask('test-frontend', ['jshint:frontEnd', 'karma']);
    grunt.registerTask('test-backend', ['jshint:backEnd']);
    grunt.registerTask('build', ['copy', 'less', 'html2js:dev', 'concat']);
    grunt.registerTask('prod', ['copy', 'less', 'html2js:prod', 'concat', 'uglify']);
    grunt.registerTask('server', ['express:dev', 'watch']);
    grunt.registerTask('docs', ['ngdocs']);
    grunt.registerTask('default', ['build']);
};
