var mysql = require('mysql');


var transaction = function(connection){
    this.connection = connection;
};

transaction.prototype = {
    begin : function(callback){
        if(!this.connection){
            callback(new Error("Transaction begin called without a connection."));
            return;
        }
        this.connection.query("BEGIN", (function(err){
            if(err){
                callback(err);
            } else {
                this.in_tx = true;
                callback();
            }
        }).bind(this));        
    },
    mark_failed  : function(){
        var callback = arguments.length > 0 && arguments[arguments.length - 1];
        this.success = false;
        if(callback){
            callback();
        }
    },
    mark_success : function(){
        var callback = arguments.length > 0 && arguments[arguments.length - 1];
        this.success = true;
        if(callback){
            callback();
        }
    },
    end : function(callback){
        if(!this.in_tx || !this.connection){
            callback();
        } else if(this.success){
            this.connection.query("COMMIT", (function(err){
                if(err){
                    callback(err);
                } else {
                    this.in_tx = false;
                    callback();
                }
            }).bind(this));
        } else {
            this.connection.query("ROLLBACK", (function(err){
                if(err){
                    callback(err);
                } else {
                    this.in_tx = false;
                    callback();
                }
            }).bind(this));
        }
    }
}

var sqlutil = {
    
    transaction : transaction,
    
    
    escape_compare : function(field, op, value){        
        if(op == 'IN'){
            if(value instanceof Array){
                if(value.length == 1){
                    return '(' + field + ' = '+mysql.escape(value)+')';
                } else if(value.length > 1){
                    value = value[1];
                } else {
                    value = undefined;
                }
            }
            
            op = '=';
        }
        if(!/^(=|==|===|!=|!==|<|<=|>|>=)$/.test(op)){
            op = '=';
        }
        
        if(value !== undefined){
            return '('+field+' '+op+' '+mysql.escape(value)+')';
        } else {
            return '(1 = 0)';
        }
        
    },
    
    apply_query_contraint: function(subject, query){
        if(query){
            if (query['=']) {
                return subject + ' = ' + mysql.escape(query['=']);
            } else if (query['IN']) {
                return subject + ' IN (' + mysql.escape(query['IN']) + ')';
            } else if (query['BETWEEN']) {
                return subject + ' BETWEEN ' + mysql.escape(query['BETWEEN'][0]) + ' AND ' + mysql.escape(query['BETWEEN'][1]);
            }
        }
        return undefined;
    },

    compile_query_constraints : function(query_contraints, fields) {
        var compiled_constraints = [];

        for(var i in query_contraints){
            var field = fields[i];
            var constraint = sqlutil.apply_query_contraint(field && field.subject, query_contraints[i]);
            if(constraint) {
                compiled_constraints.push(constraint);
            }
        }

        return compiled_constraints;
    },

    /** Computes group by fields according to given constraints.
     * @param {Object} query_constraints hash of constraints, each key is a field (must be given in fields), and its value is an object.
     * @param {Any} query_constraints.key['='] implies an equality constraint.
     * @param {Array} query_constraints.key['IN'] implies an 'in' constraint, value should be an array.
     * @param {Array} query_constraints.key['BETWEEN'] implies a 'between' constraint, value should be an array of two elements.
     * @param {Array} fields Array of field objects
     * @param {String} level upon which to group by, can be either one of the defined fields, 'auto', or 'next'.
     * @param {Object} options options object that modify the computed groups (optional).
     * @param {Boolean} options.count_only Whether to return the queried recordings, or to just count them
     */
    compute_groupby_constraints: function(query_contraints, fields, level, options) {
        options || (options = {});
        var count_only = options.count_only;
        var group_by = {
            curr    : fields[level],
            curr_level : level,
            level   : level,
            levels  : [],
            projection : [],
            columns : [],
            clause  : '',
            project_part : ''
        };
        var auto_compute = (level == 'auto' || level == 'next');
        for(var i in query_contraints){
            var field = fields[i];
            var constraint = sqlutil.apply_query_contraint(field && field.subject, query_contraints[i]);
            if(constraint && auto_compute) {
                if(field.level && (!group_by.curr || group_by.curr.level < field.level)) {
                    group_by.curr = field;
                    group_by.curr_level = i;
                }
            }
        }

        if(level == 'next'){
            if(group_by.curr){
                if(group_by.curr.next) {
                    group_by.curr_level = group_by.curr.next;
                    group_by.curr = fields[group_by.curr_level];
                }
            } else {
                for(var i in fields){
                    var field = fields[i];
                    if(field.level && (!group_by.curr || group_by.curr.level > field.level)) {
                        group_by.curr = field;
                        group_by.curr_level = i;
                    }
                }
            }
        }

        while(group_by.curr){
            group_by.levels.unshift(group_by.curr_level);
            if(count_only || group_by.curr.project) {
                group_by.projection.unshift(group_by.curr.subject + ' as ' + group_by.curr_level);
            }
            if (count_only) {
                group_by.columns.unshift(group_by.curr.subject);
            }
            group_by.curr_level = group_by.curr.prev;
            group_by.curr = fields[group_by.curr_level];
        }

        if(group_by.columns.length > 0) {
            group_by.clause = "\n GROUP BY " + group_by.columns.join(", ");
        }
        if(group_by.projection.length > 0) {
            group_by.project_part = group_by.projection.join(", ") + ",";
        }

        return group_by;
    }

};

module.exports = sqlutil;
