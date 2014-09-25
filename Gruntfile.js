
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
            
            angularRoute: {
                expand: true,
                flatten: true,
                src: 'bower_components/angular-route/*',
                dest: 'public/assets/angular-route/'
            }
        },
        
        concat: {
            dev: {
                src: [
                    'assets/js/router.js',
                    'assets/js/visualizer.js'
                ], // add project javascript files
                dest: 'public/assets/js/arbimon2.js'
            }
        },
        
        watch: { 
            options: {
                //reloads the browser with livereload plugin
                livereload: true 
            },
            less: {
                files: ['assets/less/*.less'],
                tasks: ['less']
            },
            js: {
                files: ['assets/js/*.js'],
                tasks: ['concat:dev']
            }
        }
    });
  
  
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');

    grunt.registerTask('build', ['copy', 'less', 'concat']);
    grunt.registerTask('default', ['build']);
};
