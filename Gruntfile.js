module.exports = function(grunt){
  // Project configuration.
  grunt.initConfig({
    // Metadata.
    pkg: grunt.file.readJSON('package.json'),
    banner: '/*!\n' +
            ' * Bootstrap v<%= pkg.version %> (<%= pkg.homepage %>)\n' +
            ' * Copyright 2011-<%= grunt.template.today("yyyy") %> <%= pkg.author %>\n' +
            ' * Licensed under <%= pkg.license.type %> (<%= pkg.license.url %>)\n' +
            ' */\n',
    less: {
        dev: {
            options: {
                paths: [ "assets/less" ]
            },
            files: {
                "public/stylesheets/style.css"         : "assets/less/style.less",
                "public/stylesheets/bootstrap.min.css" : "assets/less/bootstrap.less"
            }
        }
    },
    watch: {
      dev: {
        files: [ 'Gruntfile.js', 'assets/**/*.less' ],
        tasks: [ 'less:dev'],
        options: {
            atBegin: true
        }
      }
    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // Default task(s).
  grunt.registerTask('default', ['watch']);
  
}