/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var async = require('async');
var sinon = require('sinon');
// var rewire = require('rewire');
var pre_wire = require('../../mock_tools/pre_wire');

var mock_mysql = require('../../mock_tools/mock_mysql');
var mock_config = {
    db: {
        "host" : "1.2.3.4",
        "user" : "user",
        "password" : "password",
        "database" : "a2db",
        "timezone" : "Z"
    }
};

var dbpool = pre_wire('../../app/utils/dbpool', {
    '../../app/config' : function (key){

        return mock_config[key];
    },
    'mysql' : mock_mysql
});

describe('dbpool', function(){
    beforeEach(function(){
        sinon.spy(mock_mysql.types.pool.prototype, 'getConnection');
    });
    afterEach(function(){
        mock_mysql.types.pool.prototype.getConnection.restore();
    });
    describe('#pool', function(){
        it('Should be automatically created.', function(){
            should.exist(dbpool.pool);
        });
    });
    describe('#enable_query_debugging()', function(){
        it('Should rewire a connection object with debug methods.', function(done){
            var connection = new mock_mysql.types.connection();
            var spies = {
                query : sinon.spy(connection, 'query'),
                release : sinon.spy(connection, 'release')
            };
            connection.cache["query 1"]={values:[[]]};
            dbpool.enable_query_debugging(connection);
            var sss2v = {val1:1, val2:2};
            connection.query("query 1", function(err){
                if(err){
                    done(err);
                } else {
                    spies.query.calledOnce.should.be.true;
                    spies.query.calledWith("query 1").should.be.true;
                    connection.release();
                    spies.release.calledOnce.should.be.true;
                    done();
                }
            });
        });
        describe('#query()', function(){
            it('Can be called with just a query.', function(done){
                var connection = new mock_mysql.types.connection();
                var query_spy = sinon.spy(connection, 'query');
                dbpool.enable_query_debugging(connection);
                connection.cache["query 1"]={value:[[]]};
                connection.query("query 1", function(err, data){
                    should.not.exist(err);
                    query_spy.calledOnce.should.be.true;
                    query_spy.calledWith("query 1").should.be.true;
                    should.exist(data);
                    data.should.deep.equal([[]]);
                    done();
                });
            });
            it('Can be called with a query and some values.', function(done){
                var connection = new mock_mysql.types.connection();
                var query_spy = sinon.spy(connection, 'query');
                dbpool.enable_query_debugging(connection);
                connection.cache["query 2"]={value : [[1, 2, 3]]};
                connection.query("query 2", {val1:1},function(err, data){
                    should.not.exist(err);
                    query_spy.calledOnce.should.be.true;
                    query_spy.calledWith("query 2").should.be.true;
                    should.exist(data);
                    data.should.deep.equal([[1, 2, 3]]);
                    done();
                });
            }); 
            it('Can be called with an update query.', function(done){
                var connection = new mock_mysql.types.connection();
                var query_spy = sinon.spy(connection, 'query');
                dbpool.enable_query_debugging(connection);
                connection.cache["update query"]={value : {affectedRows: 2, changedRows: 1}};
                connection.query("update query", function(err, data){
                    should.not.exist(err);
                    query_spy.calledOnce.should.be.true;
                    query_spy.calledWith("update query").should.be.true;
                    should.exist(data);
                    data.affectedRows.should.equal(2);
                    data.changedRows.should.equal(1);
                    done();
                });
            });
            it('Can be called with a query and some values.', function(done){
                var connection = new mock_mysql.types.connection();
                var query_spy = sinon.spy(connection, 'query');
                dbpool.enable_query_debugging(connection);
                connection.cache["insert query"]={value : {insertId: 1}};
                connection.query("insert query", function(err, data){
                    should.not.exist(err);
                    query_spy.calledOnce.should.be.true;
                    query_spy.calledWith("insert query").should.be.true;
                    should.exist(data);
                    data.insertId.should.equal(1);
                    done();
                });
            });
            it('edge case coverage, no values, but no error.', function(done){
                var connection = new mock_mysql.types.connection();
                var query_spy = sinon.spy(connection, 'query');
                dbpool.enable_query_debugging(connection);
                connection.cache["?? query"]={no_value : true};
                connection.query("?? query", function(err, data){
                    should.not.exist(err);
                    should.not.exist(data);
                    done();
                });
            }); 
            it('Will display errors.', function(done){
                var connection = new mock_mysql.types.connection();
                var query_spy = sinon.spy(connection, 'query');
                dbpool.enable_query_debugging(connection);
                connection.query("error query", function(err, data){
                    should.exist(err);
                    should.not.exist(data);
                    done();
                });
            }); 
        });
    });
    describe('#getConnection()', function(){
        beforeEach(function(){
            sinon.spy(dbpool, 'enable_query_debugging');
        });
        afterEach(function(){
            dbpool.enable_query_debugging.restore();
        });
        it('Should retrieve a mysql connection, with debugging rewiring.', function(done){
            dbpool.getConnection(function(err, connection){
                should.not.exist(err);
                should.exist(connection);
                dbpool.enable_query_debugging.calledOnce.should.be.true;
                connection.release();
                done();
            });
        });
        it('Should propagate connection errors.', function(done){
            dbpool.pool.flag_fails_on_connection = true;
            dbpool.getConnection(function(err, connection){
                dbpool.pool.flag_fails_on_connection = false;
                should.exist(err);
                should.not.exist(connection);
                done();
            });
        });
    });
    describe('#queryHandler()', function(){
        beforeEach(function(){
            dbpool.pool.cache["query 1"]={value:[[]]};
            dbpool.pool.cache["query 2"]={value : [[1, 2, 3]]};
            dbpool.pool.cache["update query"]={value : {affectedRows: 2, changedRows: 1}};
            dbpool.pool.cache["insert query"]={value : {insertId: 1}};
            dbpool.pool.cache["?? query"]={no_value : true};
        });
        
        it('Should propagate connection errors.', function(done){
            dbpool.pool.flag_fails_on_connection = true;
            dbpool.queryHandler("query 1", function(err, connection){
                dbpool.pool.flag_fails_on_connection = false;
                should.exist(err);
                should.not.exist(connection);
                done();
            });
        });
        it('Can be called with just a query.', function(done){
            dbpool.queryHandler("query 1", function(err, data){
                should.not.exist(err);
                should.exist(data);
                data.should.deep.equal([[]]);
                done();
            });
        });
        it('Can be called with an update query.', function(done){
            dbpool.queryHandler("update query", function(err, data){
                should.not.exist(err);
                should.exist(data);
                data.affectedRows.should.equal(2);
                data.changedRows.should.equal(1);
                done();
            });
        });
        it('Can be called with a query and some values.', function(done){
            dbpool.queryHandler("insert query", function(err, data){
                should.not.exist(err);
                should.exist(data);
                data.insertId.should.equal(1);
                done();
            });
        });
        it('edge case coverage, no values, but no error.', function(done){
            dbpool.queryHandler("?? query", function(err, data){
                should.not.exist(err);
                should.not.exist(data);
                done();
            });
        }); 
        it('Will display errors.', function(done){
            dbpool.queryHandler("error query", function(err, data){
                should.exist(err);
                should.not.exist(data);
                done();
            });
        });
    });
});
