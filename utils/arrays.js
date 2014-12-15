var async = require('async');

module.exports = {
    /** Computes a set of properties for a given set of rows.
     * @param {Array} row_set set of rows in which to compute the properties.
     * @param {Array} property_set set of properties to compute. This can also
     *                be a string of comma-separated properties.
     * @param {Function} method_getter(property) function that, given a property name, returns a function for computing that property.
     *                   each property method must recieve two arguments, the first one
     *                   is the row, the second one is a callback to call when the property is computed.
     * @param {Function} callback(err, row_set) function to call back with the results
     */
    compute_row_properties : function(row_set, property_set, method_getter, callback){
        if(!property_set || !row_set){
            callback();
        } else if(typeof(property_set) == 'string'){
            property_set = property_set.split(',');
        }
        async.eachLimit(property_set, 10, function(property, next_property){
            var method = method_getter(property);
            if(method){
                async.eachLimit(row_set, 10, function(row, next_row){
                    method(row, next_row);
                }, next_property);
            } else {
                next_property(new Error("Property " + property + " cannot be computed."));
            }
        }, function(err){
            err ? callback(err) : callback(null, row_set);
        });
    },


    group_rows_by : function(rows, grouping_attribs, options){
        options || (options = {});
        var keep_keys = options.keep_keys;
        var collapse_single_leaves = options.collapse_single_leaves;
        if(!grouping_attribs) {
            return rows;
        }
        var grouped_rows = {};
        var ge_1 = grouping_attribs.length - 1;
        for(var i=0, e = rows.length; i < e; ++i){
            var row = rows[i];
            var cgroup = grouped_rows;
            for(var gi=0; gi < ge_1; ++gi){
                var grouping_attrib = grouping_attribs[gi], key = row[grouping_attrib];
                if(!keep_keys) {
                    delete row[grouping_attrib];
                }
                if(!cgroup[key]) {
                    cgroup[key] = {};
                }
                cgroup = cgroup[key];
            }
            var grouping_attrib = grouping_attribs[ge_1], key = row[grouping_attrib];
            if(!keep_keys) {
                delete row[grouping_attrib];
            }
            if(collapse_single_leaves){
                var row_keys = Object.keys(row);
                if(row_keys.length == 1) {
                    row = row[row_keys[0]];
                }
            }
            cgroup[key] = row;
        }
        return grouped_rows;
    }
}
