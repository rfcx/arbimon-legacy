

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
        this.orderBy=null;
        this.limit=null;
    },
    
    addProjection: function(/* projection columns */){
        this.select.push.apply(this.select, Array.prototype.slice.apply(arguments));
    },
    
    addTable: function(table, alias, constraint, constraint_data){
        this.tables.push(this.tableIdx[alias] = [table, alias, constraint, constraint_data]);
    },
    
    addConstraint: function(constraint, constraint_data){
        this.constraints.push([constraint, constraint_data]);
    },
    
    setOrderBy: function(term, isAscending){
        this.orderBy=[term, isAscending];
    },
    
    setLimit: function(limit, offset){
        this.limit=[limit, offset];
    },
    
    getSQL: function(){
        var projection = this.getProjection();
        var tables = this.getTables();
        var constraints = this.getConstraints();
        var order = this.getOrderBy();
        var limit = this.getLimit();
        
        return "SELECT " + projection + "\n" +
            (tables.length ? "FROM " + tables.join("\n") + "\n" : "") +
            (constraints.length ? "WHERE (" + constraints.join(")\n AND (") + ")\n" : "") +
            (order ? "ORDER BY " + order + "\n" : "") +
            (limit ? "LIMIT " + limit + "\n" : "") +
            "\n;"
        ;
    },

    getLimit: function(){
        return this.limit ? this.limit.map(parseInt).join(', ') : '';
    },

    getOrderBy: function(){
        return this.orderBy ? (dbpool.escapeId(this.orderBy[0]) + ' ' + (this.orderBy[1] ? 'ASC' : 'DESC')) : '';
    },

    getProjection: function(){
        return this.select.join(', ');
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