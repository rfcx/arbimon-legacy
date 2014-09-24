
module.exports = function(grunt) {
     grunt.initConfig({
        
        less: {
            main: { 
                files: {
                    "public/css/style.css" : "assets/less/style.less",
                }
            },
            
            bootstrap: {
                options: {
                    compress: true,
                },
                files: {
                    "public/components/bootstrap/css/bootstrap.min.css": "assets/less/bootstrap.less"
                }
            }
        },
        
        copy: { 
            bootstrap: {
                expand: true, 
                cwd: 'bower_components/bootstrap/dist/',
                src: ['fonts/*', 'js/*'],
                dest: 'public/components/bootstrap/',
            },
            
            jquery: {
                expand: true,
                flatten: true,
                src: 'bower_components/jquery/dist/*',
                dest: 'public/components/jquery/',
            },
            
            fontAwesome: {
                expand: true,
                cwd: 'bower_components/font-awesome/',
                src: ['css/*', 'fonts/*'],
                dest: 'public/components/font-awesome/',
            }
        },
        
        watch: { 
            less: {
                files: ['assets/less/*.less'], //watched files
                tasks: ['less'], //tasks to run
                options: {
                    livereload: true //reloads the browser
                }
            }
        }
    });
  
  
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.registerTask('default', ['copy', 'less']);
    grunt.registerTask('bower', ['copy:bower', 'less:bootstrap']);

};
