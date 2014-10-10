// dependencies
var mysql        = require('mysql');
// local variables
var s3;

// exports
module.exports = function(queryHandler) {
    var Species = {
        /** Finds species matching the species id.
         * @param {Integer} species_id id of the species
         * @param {Object} options options object that modify returned results (optional).
         * @param {Function} callback called back with the queried results. 
         */
        findById: function (species_id, options, callback) {
            if(options instanceof Function){
                callback = options;
                options = null;
            }
            options || (options = {});
            
            var query = "SELECT  \n" +
                'S.species_id as id, S.scientific_name, S.code_name, \n' +
                'T.taxon, F.family, S.image, S.description, S.biotab_id, S.defined_by \n' +
                "FROM species S \n" +
                "JOIN species_families F ON F.family_id = S.family_id \n" +
                "JOIN species_taxons   T ON T.taxon_id = S.taxon_id \n" +
                "WHERE species_id = " + mysql.escape(species_id);
            
            return queryHandler(query, callback);
        },
    };
    
    return Species;
}
    
