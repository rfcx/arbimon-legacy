var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;
let util = require('util');

var Songtypes = {
    /** Finds songtype matching the songtype id.
     * @param {Integer} songtype_id id of the songtype
     * @param {Object} options options object that modify returned results (optional).
     * @param {Function} callback called back with the queried results.
     */
    findById: function (songtype_id, callback) {
        var query = "SELECT  \n" +
            'St.songtype_id as id, St.songtype as name, St.description \n' +
            "FROM songtypes St \n" +
            "WHERE songtype_id = " + dbpool.escape(songtype_id);

        return queryHandler(query, callback);
    },

    findByName: function (songtype, callback) {
        return dbpool.query(
            "SELECT  \n" +
            'St.songtype_id as id, St.songtype as name, St.description \n' +
            "FROM songtypes St \n" +
            "WHERE songtype = ?",[
            songtype
        ]).nodeify(callback);
    },

    findByNameAsync: function(songtype) {
        let findByName = util.promisify(this.findByName)
        return findByName(songtype)
    },

    listAll: function(callback) {
        var q = 'SELECT songtype_id as id, songtype as name, description \n' +
                'FROM songtypes';

        queryHandler(q, callback);
    }
};

module.exports = Songtypes;
