var util = require('util');
var mysql = require('mysql');

var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;


var Species = {
    /** Finds species matching the species id.
     * @param {Integer} species_id id of the species
     * @param {Function} callback called back with the queried results.
     */
    findById: function (species_id, callback) {
        var query = "SELECT  \n" +
            'S.species_id as id, S.scientific_name, S.code_name, \n' +
            'T.taxon, F.family, S.image, S.description, S.biotab_id, S.defined_by \n' +
            "FROM species S \n" +
            "JOIN species_families F ON F.family_id = S.family_id \n" +
            "JOIN species_taxons   T ON T.taxon_id = S.taxon_id \n" +
            "WHERE species_id = " + mysql.escape(species_id);

        return queryHandler(query, callback);
    },

    list: function(limit, callback) {
        var q = 'SELECT s.scientific_name, sf.family, st.taxon, GROUP_CONCAT(sa.alias) as aliases \n'+
                'FROM species as s \n'+
                'JOIN species_taxons as st on s.taxon_id = st.taxon_id \n'+
                'JOIN species_families as sf on s.family_id = sf.family_id \n'+
                'LEFT JOIN species_aliases as sa on s.species_id = sa.species_id \n'+
                'GROUP BY s.species_id \n'+
                'LIMIT %s';

        q = util.format(q, mysql.escape(limit));
        queryHandler(q, callback);
    },
};

module.exports = Species;
