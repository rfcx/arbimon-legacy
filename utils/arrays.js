var async = require('async');
var Q = require('q');

module.exports = {
    /** Computes a set of properties for a given set of rows.
     * @param {Array} row_set set of rows in which to compute the properties.
     * @param {Array} property_set set of properties to compute. This can also
     *                be a string of comma-separated properties.
     * @param {Function} method_getter(property) function that, given a property name, returns a function for computing that property.
     *                   each property method must recieve two arguments, the first one
     *                   is the row, the second one is a callback to call when the property is computed.
     * @param {Function} callback(err, row_set) function to call back with the results
     * @return Promise with the row_set with its properties computed.
     */
    compute_row_properties : function(row_set, property_set, method_getter, callback){
        if(!property_set || !row_set){
            return Q.resolve().nodeify(callback);
        }
        
        return Q.Promise(function(resolve, reject){
            if(typeof(property_set) == 'string'){
                property_set = property_set.split(',');
            }
            console.log("property_set", property_set);
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
                if(err){
                    reject(err);
                } else {
                    resolve(row_set);                
                }
            });
        }).nodeify(callback);
    },

    sample_without_replacement: function(array, count){
        var copy = array.slice();
        var results = [];
        if(count > array.length){
            throw new Error("count > array.length");
        }
        for(var i=0; i < count; ++i){
            j = ((Math.random() * copy.length) | 0) % copy.length;
            results.push(copy.splice(j, 1)[0]);
        }
        return results;
    },

    /** Groups a set of row by a set of given attributes.
     * @param {Array} rows set of rows to group by
     * @param {Array} grouping_attribs array of attributes on wich to group the rows by.
     * @param {Object} options options that modify the groupby behaviour
     * @param {Boolean} options.keep_keys whether to keep the keys used in the group by on the rows, or to delete them (default is to delete them)
     * @param {Boolean} options.collapse_single_leaves whether rows that end up with a single attribute get collapsed and substituted by their attribute's value, or not (default is not).
     * @return an object containing groups of rows.
     */
    group_rows_by : function(rows, grouping_attribs, options){
        options = options || {};
        var keep_keys = options.keep_keys;
        var collapse_single_leaves = options.collapse_single_leaves;
        if(!grouping_attribs) {
            return rows;
        }
        var grouped_rows = {};
        var ge_1 = grouping_attribs.length - 1;
        for(var i=0, e = rows.length; i < e; ++i){
            var grouping_attrib, key;
            var row = rows[i];
            var cgroup = grouped_rows;
            for(var gi=0; gi < ge_1; ++gi){
                grouping_attrib = grouping_attribs[gi];
                key = row[grouping_attrib];
                if(!keep_keys) {
                    delete row[grouping_attrib];
                }
                if(!cgroup[key]) {
                    cgroup[key] = {};
                }
                cgroup = cgroup[key];
            }
            grouping_attrib = grouping_attribs[ge_1];
            key = row[grouping_attrib];
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
};
