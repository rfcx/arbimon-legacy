// dependencies
var mysql        = require('mysql');
// local variables
var s3;

// exports
module.exports = function(queryHandler) {
    var Songtypes = {
        /** Finds songtype matching the songtype id.
         * @param {Integer} songtype_id id of the songtype
         * @param {Object} options options object that modify returned results (optional).
         * @param {Function} callback called back with the queried results. 
         */
        findById: function (songtype_id, options, callback) {
            if(options instanceof Function){
                callback = options;
                options = null;
            }
            options || (options = {});
            
            var query = "SELECT  \n" +
                'St.songtype_id as id, St.songtype as name, St.description \n' +
                "FROM songtypes St \n" +
                "WHERE songtype_id = " + mysql.escape(songtype_id);
            
            return queryHandler(query, callback);
        },
    };
    
    return Songtypes;
}
    
