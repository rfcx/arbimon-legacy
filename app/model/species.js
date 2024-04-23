var util = require('util');

var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;


var Species = {
    /** Finds species matching the species id.
     * @param {Integer} species_id id of the species
     * @param {Function} callback called back with the queried results.
     */
    findById: function (species_id, callback) {
        var query = "SELECT S.species_id as id, \n"+
                            "S.scientific_name, \n"+
                            "S.code_name, \n"+
                            "T.taxon, \n"+
                            "F.family, \n"+
                            "S.image, \n"+
                            "S.description, \n"+
                            "S.biotab_id, \n"+
                            "S.defined_by \n" +
                    "FROM species S \n" +
                    "JOIN species_families F ON F.family_id = S.family_id \n" +
                    "JOIN species_taxons   T ON T.taxon_id = S.taxon_id \n" +
                    "WHERE S.species_id = " + dbpool.escape(species_id);

        queryHandler(query, callback);
    },

    findByName: function (scientific_name, callback) {
        return dbpool.query(
                "SELECT S.species_id as id, \n"+
                        "S.scientific_name, \n"+
                        "S.code_name, \n"+
                        "T.taxon, \n"+
                        "F.family, \n"+
                        "S.image, \n"+
                        "S.description, \n"+
                        "S.biotab_id, \n"+
                        "S.defined_by \n" +
                "FROM species S \n" +
                "JOIN species_families F ON F.family_id = S.family_id \n" +
                "JOIN species_taxons   T ON T.taxon_id = S.taxon_id \n" +
                "WHERE S.scientific_name = ?", [
                scientific_name
        ]).nodeify(callback);
    },

    list: function(limit, callback) {
        var q = 'SELECT s.species_id as id, s.scientific_name, sf.family, st.taxon, GROUP_CONCAT(sa.alias) as aliases \n'+
                'FROM species as s \n'+
                'JOIN species_taxons as st on s.taxon_id = st.taxon_id \n'+
                'JOIN species_families as sf on s.family_id = sf.family_id \n'+
                'LEFT JOIN species_aliases as sa on s.species_id = sa.species_id \n'+
                'GROUP BY s.species_id \n'+
                'LIMIT %s';

        q = util.format(q, dbpool.escape(limit));
        queryHandler(q, callback);
    },

    search: function(squery, callback) {
        var q = "SELECT s.species_id as id, s.scientific_name, sf.family, st.taxon, GROUP_CONCAT(sa.alias) as aliases \n"+
                "FROM species as s \n"+
                "JOIN species_taxons as st on s.taxon_id = st.taxon_id \n"+
                "JOIN species_families as sf on s.family_id = sf.family_id \n"+
                "LEFT JOIN species_aliases as sa on s.species_id = sa.species_id \n"+
                "WHERE s.scientific_name LIKE %s \n"+
                "OR sf.family LIKE %s \n"+
                "OR st.taxon LIKE %s \n"+
                "OR sa.alias LIKE %s \n"+
                "GROUP BY s.species_id \n"+
                "LIMIT 100";
        var term = dbpool.escape('%'+squery+'%');
        q = util.format(q,
            term,
            term,
            term,
            term
        );

        queryHandler(q, callback);
    },

    countProjectSpecies: function(projectId) {
        return dbpool.query(`SELECT COUNT(DISTINCT species_id) AS count FROM project_classes WHERE project_id = ${dbpool.escape(projectId)}`).get(0).get('count');
    },

    countAllSpecies: function() {
        const q = 'SELECT COUNT(DISTINCT species_id) AS count FROM recording_validations WHERE present = 1 OR present_review > 0 OR present_aed > 0'
        return dbpool.query(q).get(0).get('count')
    },
};

module.exports = Species;
