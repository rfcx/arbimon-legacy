
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
            
            angular: {
                expand: true,
                flatten: true,
                src: 'bower_components/angular/*',
                dest: 'public/assets/angular/'
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
            }
        },
        
        concat: {
            dev: {
                src: [   // add project javascript files here
                    'assets/js/router.js',
                    'assets/js/visualizer.js',
                    'assets/js/home.js',
                    'assets/js/dashboard.js',
                    'assets/js/a2services.js',
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
                    'public/partials/**/*.html',
                    'views/**/*.ejs'
                ],
                tasks:[]
            },
            less: {
                files: ['assets/less/**/*.less'],
                tasks: ['less']
            },
            frontendjs: {
                files: ['assets/js/*.js'],
                tasks: ['concat:dev']
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
                tasks: ['express:dev']
            }
        },
        
        express: {
            dev: {
                options: {
                    script: 'bin/www'
                }
            }
        }
    });
    
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-express-server');

   
    grunt.registerTask('build', ['copy', 'less', 'concat']);
    grunt.registerTask('default', ['build']);
    grunt.registerTask('server', ['express:dev', 'watch']);
};
