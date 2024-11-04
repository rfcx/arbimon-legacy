var dbpool = require('./dbpool');

function SQLBuilder(){
    this.reset();
}

function stringifyConstraint(expression, data){
    return data ? dbpool.format(expression, data) : expression;
}

SQLBuilder.prototype = {
    reset: function(){
        this.select=[];
        this.tables=[];
        this.tableIdx={};
        this.constraints=[];
        this.having=[];
        this.orderBy=null;
        this.limit=null;
    },

    escapeId: function(value){
        return dbpool.escapeId(value);
    },

    escape: function(value){
        return dbpool.escape(value);
    },

    addProjection: function(/* projection columns */){
        this.select.push.apply(this.select, Array.prototype.slice.apply(arguments));
    },

    addTable: function(table, alias, constraint, constraint_data){
        this.tables.push(this.tableIdx[alias] = [table, alias, constraint, constraint_data]);
    },

    addHaving: function(constraint){
        this.having.push(constraint);
    },

    addConstraint: function(constraint, constraint_data){
        this.constraints.push([constraint, constraint_data]);
    },

    setOrderBy: function(term, isAscending){
        this.orderBy=[[term, isAscending]];
    },

    setOrderByMult: function(arr){
        this.orderBy=arr;
    },

    setGroupBy: function(term, isAscending){
        this.groupBy=[[term, isAscending]];
    },

    addOrderBy: function(term, isAscending){
        (this.orderBy || (this.orderBy=[])).push([term, isAscending]);
    },

    addGroupBy: function(term, isAscending){
        (this.groupBy || (this.groupBy=[])).push([term, isAscending]);
    },

    setLimit: function(limit, offset){
        this.limit=[offset, limit];
    },

    getSQL: function(){
        var projection = this.getProjection();
        var tables = this.getTables();
        var constraints = this.getConstraints();
        var order = this.getOrderBy();
        var group = this.getGroupBy();
        var having = this.getHaving();
        var limit = this.getLimit();

        return "SELECT\n    " + projection + "\n" +
            (tables.length ? "FROM " + tables.join("\n") + "\n" : "") +
            (constraints.length ? "WHERE (" + constraints.join(")\n AND (") + ")\n" : "") +
            (group ? "GROUP BY " + group + "\n" : "") +
            (having ? "HAVING " + having + "\n" : "") +
            (order ? "ORDER BY " + order + "\n" : "") +
            (limit ? "LIMIT " + limit + "\n" : "") +
            "\n;"
        ;
    },

    getLimit: function(){
        return this.limit ? this.limit.map(x => x|0).join(', ') : '';
    },

    getOrderBy: function(){
        return this.orderBy ? this.orderBy.map(item => dbpool.escapeId(item[0]) + ' ' + (item[1] ? 'ASC' : 'DESC')).join(', ') : '';
    },

    getGroupBy: function(){
        return this.groupBy ? this.groupBy.map(item => dbpool.escapeId(item[0])).join(', ') : '';
    },

    getHaving: function(){
        return this.having ? this.having.join(', ') : '';
    },

    getProjection: function(){
        return this.select.join(',\n    ');
    },

    getTables: function(){
        return this.tables.map(function(tabledef){
            return tabledef[0] + (tabledef[1] ? " AS " + tabledef[1] : "") + (
                tabledef[2] ? " ON " + stringifyConstraint(tabledef[2], tabledef[3]) : ""
            );
        });
    },

    getConstraints: function(){
        return this.constraints.map(function(constraintdef){
            return stringifyConstraint(constraintdef[0], constraintdef[1]);
        });
    }
};


module.exports = SQLBuilder;
