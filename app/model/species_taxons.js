const dbpool = require('../utils/dbpool');
const queryHandler = dbpool.queryHandler;


const SpeciesTaxons = {
    listAll: function(callback) {
        const q = `SELECT taxon_id as id, taxon
            FROM species_taxons WHERE enabled = 1`;

        queryHandler(q, callback);
    }
};

module.exports = SpeciesTaxons;
