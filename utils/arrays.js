module.exports = {
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