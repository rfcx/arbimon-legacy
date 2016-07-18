/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";
// node_modules/.bin/istanbul cover node_modules/.bin/_mocha test/app/utils/sqlutil.js

var chai = require('chai'), should = chai.should(), expect = chai.expect;
var async = require('async');
var sinon = require('sinon');


var rewire = require('rewire');

var mock_mysql = require('../mock_tools/mock_mysql');
var scrub_object = require('../mock_tools/scrub_object');


var sqlutil = rewire('../../app/utils/sqlutil');
sqlutil.__set__({mysql: mock_mysql});

describe('sqlutil', function(){
    describe('#transaction()', function(){
        describe('new', function(){
            it('Constructor should work.', function(){
                var transaction = new sqlutil.transaction();
            });
        });
        describe('begin', function(){
            it('Should fail if transaction has no connection.', function(){
                var transaction = new sqlutil.transaction();
                transaction.begin(function(err){
                    should.exist(err);
                    should.exist(err.message);
                    err.message.should.equal('Transaction begin called without a connection.');
                });
            });
            it('Should begin a transaction if it has a connection.', function(done){
                var conn = new mock_mysql.types.connection();
                var transaction = new sqlutil.transaction(conn);
                transaction.begin(function(err){
                    should.exist(err);
                    should.exist(err.message);
                    err.message.should.equal('Query not in cache : BEGIN');
                    conn.cache.BEGIN={no_value:true};
                    transaction.begin(function(err){
                        should.not.exist(err);
                        done();
                    });
                });
            });
        });
        describe('mark_failed', function(){
            var conn, transaction;
            beforeEach(function(done){
                conn = new mock_mysql.types.connection();
                conn.cache.BEGIN={no_value:true};
                transaction = new sqlutil.transaction(conn);
                transaction.begin(function(err){
                    done();
                });
            });
            it('Should mark a transaction as failed. Sync version', function(){
                transaction.mark_failed();
                transaction.success.should.be.false;
            });
            it('Should mark a transaction as failed. async version', function(done){
                transaction.mark_failed(function(){
                    transaction.success.should.be.false;
                    done();                        
                });
            });
        });
        describe('mark_success', function(){
            var conn, transaction;
            beforeEach(function(done){
                conn = new mock_mysql.types.connection();
                conn.cache.BEGIN={no_value:true};
                transaction = new sqlutil.transaction(conn);
                transaction.begin(function(err){
                    done();
                });
            });
            it('Should mark a transaction as successfull. Sync version', function(){
                transaction.mark_success();
                transaction.success.should.be.true;
            });
            it('Should mark a transaction as successfull. async version', function(done){
                transaction.mark_success(function(){
                    transaction.success.should.be.true;
                    done();                        
                });
            });
        });
        describe('end', function(){
            var conn, transaction;
            beforeEach(function(done){
                conn = new mock_mysql.types.connection();
                conn.cache.BEGIN={no_value:true};
                transaction = new sqlutil.transaction(conn);
                transaction.begin(function(err){
                    done();
                });
            });
            it('Should commit a transaction if it is successfull.', function(done){
                transaction.mark_success();
                transaction.end(function(err){
                    should.exist(err);
                    should.exist(err.message);
                    err.message.should.equal('Query not in cache : COMMIT');
                    conn.cache.COMMIT={no_value:true};
                    transaction.end(function(err){
                        should.not.exist(err);
                        transaction.in_tx.should.be.false;
                        done();
                    });
                });
            });
            it('Should rollback a transaction if it is marked as failed.', function(done){
                transaction.mark_failed();
                transaction.end(function(err){
                    should.exist(err);
                    should.exist(err.message);
                    err.message.should.equal('Query not in cache : ROLLBACK');
                    conn.cache.ROLLBACK={no_value:true};
                    transaction.end(function(err){
                        should.not.exist(err);
                        transaction.in_tx.should.be.false;
                        done();
                    });
                });
            });
            it('Should rollback a transaction if it was never marked as anything.', function(done){
                transaction.end(function(err){
                    should.exist(err);
                    should.exist(err.message);
                    err.message.should.equal('Query not in cache : ROLLBACK');
                    conn.cache.ROLLBACK={no_value:true};
                    transaction.end(function(err){
                        should.not.exist(err);
                        transaction.in_tx.should.be.false;
                        done();
                    });
                });
            });
            it('Should do nothing if we are not in a transaction.', function(done){
                transaction.connection = null;
                transaction.in_tx = true;
                transaction.end(function(err){
                    should.not.exist(err);
                    transaction.in_tx.should.be.true;
                    
                    transaction.connection = conn;
                    transaction.in_tx = false;
                    transaction.end(function(err){
                        should.not.exist(err);
                        transaction.in_tx.should.be.false;
                        done();
                    });
                });
            });
            
        });
    });

    describe('#escape_compare()', function(){
        it('Should escape comprarisons properly', function(){
            sqlutil.escape_compare('lhs', '='   , 1).should.equal('(lhs = 1)');
            sqlutil.escape_compare('lhs', '=='  , 1).should.equal('(lhs == 1)');
            sqlutil.escape_compare('lhs', '===' , 1).should.equal('(lhs === 1)');
            sqlutil.escape_compare('lhs', '!='  , 1).should.equal('(lhs != 1)');
            sqlutil.escape_compare('lhs', '!==' , 1).should.equal('(lhs !== 1)');
            sqlutil.escape_compare('lhs', '<'   , 1).should.equal('(lhs < 1)');
            sqlutil.escape_compare('lhs', '<='  , 1).should.equal('(lhs <= 1)');
            sqlutil.escape_compare('lhs', '>'   , 1).should.equal('(lhs > 1)');
            sqlutil.escape_compare('lhs', '>='  , 1).should.equal('(lhs >= 1)');
        });
        it('Should escape against bobby tables (properly escape strings)', function(){
            sqlutil.escape_compare('lhs', '='   , "Robert").should.equal("(lhs = 'Robert')");
            sqlutil.escape_compare('lhs', '='   , "Robert'); DROP TABLE Students;--").should.equal("(lhs = 'Robert\\'); DROP TABLE Students;--')");
        });
        it('Should coerce unknown operators to \'=\'', function(){
            sqlutil.escape_compare('lhs', '?', 1).should.equal('(lhs = 1)');
            sqlutil.escape_compare('lhs', undefined, 1).should.equal('(lhs = 1)');
        });
        it('Should escape comparissons against undefined as a false-valued expression', function(){
            sqlutil.escape_compare('lhs', '=', undefined).should.equal('(1 = 0)');
        });
        it('Should expand \'IN\' comparissons with arrays of size > 1', function(){
            sqlutil.escape_compare('lhs', 'IN', [1, 2]).should.equal('(lhs IN (1, 2))');
        });
        it('Should coerce \'IN\' comparissons with arrays of size == 1 to \'=\' comparisson', function(){
            sqlutil.escape_compare('lhs', 'IN', [1]).should.equal('(lhs = 1)');
        });
        it('Should coerce arrays of size == 0 in \'IN\' comparissons to undefined', function(){
            sqlutil.escape_compare('lhs', 'IN', []).should.equal('(1 = 0)');
        });
        it('Should coerce \'IN\' comparissons with non-array values to \'=\' comparisson', function(){
            sqlutil.escape_compare('lhs', 'IN', 1).should.equal('(lhs = 1)');
            sqlutil.escape_compare('lhs', 'IN', '1').should.equal('(lhs = \'1\')');
        });
    });
    describe('#apply_query_contraint()', function(){
        it('Should apply the = constraint properly.', function(){
            var q={};
            q['='] = 1;
            sqlutil.apply_query_contraint('lhs', q).should.equal('lhs = 1');
            q['='] = '1';
            sqlutil.apply_query_contraint('lhs', q).should.equal('lhs = \'1\'');
        });
        it('Should apply the IN constraint properly.', function(){
            var q={IN:[1,2,3]};
            sqlutil.apply_query_contraint('lhs', q).should.equal('lhs IN (1, 2, 3)');
        });
        it('Should apply the BETWEEN constraint properly.', function(){
            var q={BETWEEN:[1,2]};
            sqlutil.apply_query_contraint('lhs', q).should.equal('lhs BETWEEN 1 AND 2');
        });
        it('Should return undefined if the constraint is otherwise.', function(){
            should.not.exist(sqlutil.apply_query_contraint('lhs', undefined));
            should.not.exist(sqlutil.apply_query_contraint('lhs', {}));
            should.not.exist(sqlutil.apply_query_contraint('lhs', {meanwhile:1}));
            should.not.exist(sqlutil.apply_query_contraint('lhs', {also:2}));
        });
    });
    describe('#compile_query_constraints()', function(){
        it('Should return a list of applied query constraints.', function(){
            var q={};
            q['=']=1;
            sqlutil.compile_query_constraints([
                q, {IN:[1,2,3,'4']}, {BETWEEN:[1, 2]}
            ], [
                {subject:'lhs1'},
                {subject:'lhs2'},
                {subject:'lhs3'}
            ]).should.deep.equal([
                'lhs1 = 1',
                'lhs2 IN (1, 2, 3, \'4\')',
                'lhs3 BETWEEN 1 AND 2'
            ]);
        });
        it('Should ignore invalid constraints.', function(){
            var q={};
            q['=']=1;
            sqlutil.compile_query_constraints([
                q, {IN:[1,2,3,'4']}, {BETWEEN:[1, 2]},
                undefined, {}, {meanwhile:1}, {also:2}
            ], [
                {subject:'lhs1'},
                {subject:'lhs2'},
                {subject:'lhs3'},
                {subject:'lhs4'},
                {subject:'lhs5'},
                {subject:'lhs6'}
            ]).should.deep.equal([
                'lhs1 = 1',
                'lhs2 IN (1, 2, 3, \'4\')',
                'lhs3 BETWEEN 1 AND 2'
            ]);
        });
    });
    describe('#compute_groupby_constraints()', function(){
        var FIELDS = {
            id : {subject: 'id_lhs', project: true                                   },
            f1 : {subject: 'f1_lhs', project: false, level:1, next: 'f2'             },
            f2 : {subject: 'f2_lhs', project: true , level:2, prev:'f1' }
        };
        var FIELD_NAMES=['id','f1','f2'];
        var levels=['f1','f2','auto','next'];
        
        var make_test_case = function(i, constraints, level, count_only, output){
            it('Automated test case #'+i+', level:'+level+', count:'+(count_only|0)+'.', function(){
                scrub_object(
                    sqlutil.compute_groupby_constraints(constraints, FIELDS, level, count_only ? {count_only: true} : undefined)
                ).should.deep.equal(results[i][level][count_only | 0]);
            });
        };
        var base_count = Math.pow(2, FIELD_NAMES.length);
        // var levels=['f1'];
        // var base_count=1;
        var q1={IN:[1]}, q0;
        for(var i=0; i < base_count; ++i){
            var constraints = {};
            for(var j=0; j < levels.length;++j){
                constraints[FIELD_NAMES[j]] = (i&(1<<j)) ? q1 : q0;
            }
            for(var lj=0,le=levels.length; lj < le; ++lj){
                var level = levels[lj];
                make_test_case(i, constraints, level, false);
                make_test_case(i, constraints, level, true);
            }
        }
        var results = {
            "0": {
                "f1": [{
                    "level": "f1",
                    "levels": ["f1"],
                    "projection": [],
                    "columns": [],
                    "clause": "",
                    "project_part": ""
                }, {
                    "level": "f1",
                    "levels": ["f1"],
                    "projection": ["f1_lhs as f1"],
                    "columns": ["f1_lhs"],
                    "clause": "\n GROUP BY f1_lhs",
                    "project_part": "f1_lhs as f1,"
                }],
                "f2": [{
                    "level": "f2",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "f2",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }],
                "auto": [{
                    "curr_level": "auto",
                    "level": "auto",
                    "levels": [],
                    "projection": [],
                    "columns": [],
                    "clause": "",
                    "project_part": ""
                }, {
                    "curr_level": "auto",
                    "level": "auto",
                    "levels": [],
                    "projection": [],
                    "columns": [],
                    "clause": "",
                    "project_part": ""
                }],
                "next": [{
                    "level": "next",
                    "levels": ["undefined"],
                    "projection": [],
                    "columns": [],
                    "clause": "",
                    "project_part": ""
                }, {
                    "level": "next",
                    "levels": ["undefined"],
                    "projection": ["f1_lhs as undefined"],
                    "columns": ["f1_lhs"],
                    "clause": "\n GROUP BY f1_lhs",
                    "project_part": "f1_lhs as undefined,"
                }]
            },
            "1": {
                "f1": [{
                    "level": "f1",
                    "levels": ["f1"],
                    "projection": [],
                    "columns": [],
                    "clause": "",
                    "project_part": ""
                }, {
                    "level": "f1",
                    "levels": ["f1"],
                    "projection": ["f1_lhs as f1"],
                    "columns": ["f1_lhs"],
                    "clause": "\n GROUP BY f1_lhs",
                    "project_part": "f1_lhs as f1,"
                }],
                "f2": [{
                    "level": "f2",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "f2",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }],
                "auto": [{
                    "curr_level": "auto",
                    "level": "auto",
                    "levels": [],
                    "projection": [],
                    "columns": [],
                    "clause": "",
                    "project_part": ""
                }, {
                    "curr_level": "auto",
                    "level": "auto",
                    "levels": [],
                    "projection": [],
                    "columns": [],
                    "clause": "",
                    "project_part": ""
                }],
                "next": [{
                    "level": "next",
                    "levels": ["undefined"],
                    "projection": [],
                    "columns": [],
                    "clause": "",
                    "project_part": ""
                }, {
                    "level": "next",
                    "levels": ["undefined"],
                    "projection": ["f1_lhs as undefined"],
                    "columns": ["f1_lhs"],
                    "clause": "\n GROUP BY f1_lhs",
                    "project_part": "f1_lhs as undefined,"
                }]
            },
            "2": {
                "f1": [{
                    "level": "f1",
                    "levels": ["f1"],
                    "projection": [],
                    "columns": [],
                    "clause": "",
                    "project_part": ""
                }, {
                    "level": "f1",
                    "levels": ["f1"],
                    "projection": ["f1_lhs as f1"],
                    "columns": ["f1_lhs"],
                    "clause": "\n GROUP BY f1_lhs",
                    "project_part": "f1_lhs as f1,"
                }],
                "f2": [{
                    "level": "f2",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "f2",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }],
                "auto": [{
                    "level": "auto",
                    "levels": ["f1"],
                    "projection": [],
                    "columns": [],
                    "clause": "",
                    "project_part": ""
                }, {
                    "level": "auto",
                    "levels": ["f1"],
                    "projection": ["f1_lhs as f1"],
                    "columns": ["f1_lhs"],
                    "clause": "\n GROUP BY f1_lhs",
                    "project_part": "f1_lhs as f1,"
                }],
                "next": [{
                    "level": "next",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "next",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }]
            },
            "3": {
                "f1": [{
                    "level": "f1",
                    "levels": ["f1"],
                    "projection": [],
                    "columns": [],
                    "clause": "",
                    "project_part": ""
                }, {
                    "level": "f1",
                    "levels": ["f1"],
                    "projection": ["f1_lhs as f1"],
                    "columns": ["f1_lhs"],
                    "clause": "\n GROUP BY f1_lhs",
                    "project_part": "f1_lhs as f1,"
                }],
                "f2": [{
                    "level": "f2",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "f2",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }],
                "auto": [{
                    "level": "auto",
                    "levels": ["f1"],
                    "projection": [],
                    "columns": [],
                    "clause": "",
                    "project_part": ""
                }, {
                    "level": "auto",
                    "levels": ["f1"],
                    "projection": ["f1_lhs as f1"],
                    "columns": ["f1_lhs"],
                    "clause": "\n GROUP BY f1_lhs",
                    "project_part": "f1_lhs as f1,"
                }],
                "next": [{
                    "level": "next",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "next",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }]
            },
            "4": {
                "f1": [{
                    "level": "f1",
                    "levels": ["f1"],
                    "projection": [],
                    "columns": [],
                    "clause": "",
                    "project_part": ""
                }, {
                    "level": "f1",
                    "levels": ["f1"],
                    "projection": ["f1_lhs as f1"],
                    "columns": ["f1_lhs"],
                    "clause": "\n GROUP BY f1_lhs",
                    "project_part": "f1_lhs as f1,"
                }],
                "f2": [{
                    "level": "f2",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "f2",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }],
                "auto": [{
                    "level": "auto",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "auto",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }],
                "next": [{
                    "level": "next",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "next",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }]
            },
            "5": {
                "f1": [{
                    "level": "f1",
                    "levels": ["f1"],
                    "projection": [],
                    "columns": [],
                    "clause": "",
                    "project_part": ""
                }, {
                    "level": "f1",
                    "levels": ["f1"],
                    "projection": ["f1_lhs as f1"],
                    "columns": ["f1_lhs"],
                    "clause": "\n GROUP BY f1_lhs",
                    "project_part": "f1_lhs as f1,"
                }],
                "f2": [{
                    "level": "f2",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "f2",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }],
                "auto": [{
                    "level": "auto",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "auto",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }],
                "next": [{
                    "level": "next",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "next",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }]
            },
            "6": {
                "f1": [{
                    "level": "f1",
                    "levels": ["f1"],
                    "projection": [],
                    "columns": [],
                    "clause": "",
                    "project_part": ""
                }, {
                    "level": "f1",
                    "levels": ["f1"],
                    "projection": ["f1_lhs as f1"],
                    "columns": ["f1_lhs"],
                    "clause": "\n GROUP BY f1_lhs",
                    "project_part": "f1_lhs as f1,"
                }],
                "f2": [{
                    "level": "f2",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "f2",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }],
                "auto": [{
                    "level": "auto",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "auto",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }],
                "next": [{
                    "level": "next",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "next",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }]
            },
            "7": {
                "f1": [{
                    "level": "f1",
                    "levels": ["f1"],
                    "projection": [],
                    "columns": [],
                    "clause": "",
                    "project_part": ""
                }, {
                    "level": "f1",
                    "levels": ["f1"],
                    "projection": ["f1_lhs as f1"],
                    "columns": ["f1_lhs"],
                    "clause": "\n GROUP BY f1_lhs",
                    "project_part": "f1_lhs as f1,"
                }],
                "f2": [{
                    "level": "f2",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "f2",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }],
                "auto": [{
                    "level": "auto",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "auto",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }],
                "next": [{
                    "level": "next",
                    "levels": ["f1", "f2"],
                    "projection": ["f2_lhs as f2"],
                    "columns": [],
                    "clause": "",
                    "project_part": "f2_lhs as f2,"
                }, {
                    "level": "next",
                    "levels": ["f1", "f2"],
                    "projection": ["f1_lhs as f1", "f2_lhs as f2"],
                    "columns": ["f1_lhs", "f2_lhs"],
                    "clause": "\n GROUP BY f1_lhs, f2_lhs",
                    "project_part": "f1_lhs as f1, f2_lhs as f2,"
                }]
            }
        };
    });

});
