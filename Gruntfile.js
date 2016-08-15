
module.exports = function(grunt) {
    var initcfg = {
        pkg: grunt.file.readJSON('package.json'),
        
        //backend documentation
        jsdoc : {
            main: {
                src: [
                    'app.js',
                    'routes/**/*.js',
                    'model/**/*.js',
                    'utils/**/*.js',
                    'config/**/*.js',
                    'test/**/*.js'
                ],
                options: {
                    destination: 'docs/backend',
                    readme: './README.md',
                    configure: 'jsdoc.conf.json'
                }
            }
        },
        
        jshint: {
            frontEnd: ['assets/app/**/*.js', 'assets/test/**/*.js'],
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
        
        karma: {
            unit: {
                configFile: 'karma.conf.js'
            }
        },
        
        mocha_istanbul: {
            coverage: {
                src: 'test',
            },
        },
        
        angular_architecture_graph: {
            diagram: {
                files: {
                    "angular-depends": [
                        "assets/app/**/*.js"
                    ]
                }
            }
        },
        

    };
    
    grunt.initConfig(initcfg);
    
    grunt.loadNpmTasks('grunt-angular-architecture-graph');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks('grunt-lesslint');
    grunt.loadNpmTasks('grunt-jsdoc');
    grunt.loadNpmTasks('grunt-mocha-istanbul');
    
    grunt.registerTask('angular-depends', ['angular_architecture_graph']);
    grunt.registerTask('test-frontend', ['html2js:dev', 'karma:unit']);
    grunt.registerTask('test-backend', ['mocha_istanbul']);
    grunt.registerTask('test', ['jshint', 'test-frontend', 'test-backend']);
    grunt.registerTask('build', ['copy', 'less', 'html2js:dev', 'ngAnnotate:main']);
    grunt.registerTask('prod', ['copy', 'less', 'html2js:prod', 'ngAnnotate:main', 'uglify']);
    grunt.registerTask('server', ['express:dev', 'watch']);
    grunt.registerTask('docs', ['ngdocs']);
    grunt.registerTask('default', ['build']);
};
