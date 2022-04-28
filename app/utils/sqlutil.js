var mysql = require('mysql');
var q = require('q');


var transaction = function(connection){
    this.connection = connection;
};

transaction.prototype = {
    perform: function(transactionFn){
        var dbconn = this.connection;
        return this.begin().thenResolve(this).then(transactionFn).then(function(value){
            return q.ninvoke(dbconn, 'query', "COMMIT").then(function(){
                return value;
            });
        }, function(err){
            return q.ninvoke(dbconn, 'query', "ROLLBACK").then(function(){
                throw err;
            });
        });
    },
    begin : function(callback){
        if(!this.connection){
            callback(new Error("Transaction begin called without a connection."));
            return;
        }

        return q.ninvoke(this.connection, 'query', "BEGIN").then((function(){
            this.in_tx = true;
        }).bind(this)).nodeify(callback);
    },
    mark_failed  : function(){
        this.success = false;
        return q.resolve().nodeify(arguments.length > 0 && arguments[arguments.length - 1]);
    },
    mark_success : function(){
        this.success = true;
        return q.resolve().nodeify(arguments.length > 0 && arguments[arguments.length - 1]);
    },
    end : function(callback){
        return (
            (!this.in_tx || !this.connection) ?
            q.resolve() :
            q.ninvoke(this.connection, 'query', this.success ? "COMMIT" : "ROLLBACK").then((function(){
                this.in_tx = false;
            }).bind(this))
        ).nodeify(callback);
    }
};

var sqlutil = {

    transaction : transaction,

    /** Returns a properly escaped SQL comparison expression.
     *  @param {String} field - the field name (or the lhs of the expression).
     *                        this is assumed to be clean, and therefore not escaped.
     *  @param {String} op - the comparisson operation. Can be one of
     *                     ['IN','=','==','===','!=','!==','<','<=','>','>=']
     *                     If op is 'IN' and value is an array of length > 1,
     *                     then the comparisson is of the mode lhs IN (rhs[0], ...),
     *                     with each rhs[0] properly escaped.
     *  @param {Object} value - the value to compare to (the rhs of the expression).
     *                        value is assumed to be unclean and gets escaped.
     *                        If value is undefined, the the comparisson always returns false.
     *  @return An sql comparisson expression with its rhs properly escaped.
     *        'IN' comparissons with array values of more than one element are expanded,
     *        and comparissons against undefined rhs are automatically false.
     *        the expression is wrapped in parenthesis.
     */
    escape_compare : function(field, op, value){
        if(op == 'IN'){
            if(value instanceof Array){
                if(value.length == 1){
                    return '(' + field + ' = '+mysql.escape(value)+')';
                } else if(value.length > 1){
                    value = value.map(mysql.escape);
                    return '('+field+' IN ('+value.join(', ')+'))';
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

    /** Returns a logical expression on a subject, given a query constraint.
     *  @param {String} subject - the lhs of the expression.
     *  @param {Object} query - the query constraint object. Must have only one attribute
     *                          as defined below.
     *  @param {Object} query['='] - if set, then the expression resolves to lhs = escape(rhs)
     *  @param {Object} query.IN   - if set, then the expression resolves to lhs IN (escape(rhs))
     *  @param {Object} query.BETWEEN  - if set, it must be an array of size two and
     *                               the expression resolves to lhs BETWEEN escape(rhs[0]) AND escape(rhs[1])
     *  @return a logical expression resulting from applying the query constraint to the given subject.
     *          or undefined, if the query constraint does not define a proper constraint.
     */
    apply_query_contraint: function(subject, query){
        if(query){
            if (query['=']) {
                return subject + ' = ' + mysql.escape(query['=']);
            } else if (query.IN) {
                return subject + ' IN (' + mysql.escape(query.IN) + ')';
            } else if (query.BETWEEN) {
                return subject + ' BETWEEN ' + mysql.escape(query.BETWEEN[0]) + ' AND ' + mysql.escape(query.BETWEEN[1]);
            } else if(query.no_match){
                return '1 = 0';
            }
        }
        return undefined;
    },

    /** Returns an Array of valid query constraints applied to fields, given a list of fields and a list of query constraints.
     *  @see apply_query_contraint().
     *  @param {Array} query_contraints - Array of query constraints.
     *  @param {Array} fields - Array of fields. Each item must have a subject attribute wich represents the field's subject.
     *  @return an Array of valid query constraints applied their respective field's subject.
     */
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
        options = options || {};
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
        var field;

        for(var i in query_contraints){
            field = fields[i];
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
                for(var j in fields){
                    field = fields[j];
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
    },

    parseUtcDatetime: function (field, next) {
        if (field.type !== 'DATETIME') return next(); // 1 = true, 0 = false
        return new Date(field.string() + ' GMT');
    },
};

module.exports = sqlutil;
