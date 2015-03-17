/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var async = require('async');

var arrays = require('../../utils/arrays');


describe('arrays', function(){
    describe('compute_row_properties', function(){
        var pow_computer=function(property){
            var m=/^x(\d+?)$/.exec(property);
            if(m){
                var p = +m[1];
                return function(row, callback){
                    row[property] = Math.pow(row.x, p);
                    callback();
                };
            } else {
                return undefined;
            }
        };
        it('Should compute a the given properties for each row.', function(done){
            var rowset=[{x:1}, {x:2}, {x:3}, {x:4}];
            var output=[{x:1,x2:1,x3:1}, {x:2,x2:4,x3:8}, {x:3,x2:9,x3:27}, {x:4,x2:16,x3:64}];
            arrays.compute_row_properties(rowset, ['x2', 'x3'], pow_computer, function(err, result){
                should.not.exist(err);
                should.exist(result);
                result.should.deep.equal(output);
                done();
            });
        });
        it('Should split the properties when given as a comma separated string.', function(done){
            var rowset=[{x:1}, {x:2}, {x:3}, {x:4}];
            var output=[{x:1,x2:1,x3:1}, {x:2,x2:4,x3:8}, {x:3,x2:9,x3:27}, {x:4,x2:16,x3:64}];
            arrays.compute_row_properties(rowset, 'x2,x3', pow_computer, function(err, result){
                should.not.exist(err);
                should.exist(result);
                result.should.deep.equal(output);
                done();
            });
        });
        it('Should fail if a property cannot be computed.', function(done){
            var rowset=[{x:1}, {x:2}, {x:3}, {x:4}];
            arrays.compute_row_properties(rowset, 'exp(x)', pow_computer, function(err, result){
                should.exist(err);
                should.exist(err.message);
                err.message.should.equal('Property exp(x) cannot be computed.');
                done();
            });
        });
        
        it('Should do nothing when given an empty property list.', function(done){
            var rowset=[{x:1}, {x:2}, {x:3}, {x:4}];
            arrays.compute_row_properties(rowset, [], undefined, function(err, result){
                should.not.exist(err);
                should.exist(result);
                result.should.equal(rowset);
                done();
            });
        });
        it('Should callback undefined when calling with undefined row set.', function(done){
            arrays.compute_row_properties(undefined, [], undefined, function(err, result){
                should.not.exist(err);
                should.not.exist(result);
                done();
            });
        });
        it('Should callback undefined when calling with undefined property list.', function(done){
            arrays.compute_row_properties([], undefined, undefined, function(err, result){
                should.not.exist(err);
                should.not.exist(result);
                done();
            });
        });
    });
    describe('group_rows_by', function(){
        it('Should group rows by the given attributes.', function(){
            var rowset=[{x:1,y:1,a:'a'}, {x:2,y:1,a:'b'}, {x:3,y:4,a:'a'}, {x:4,y:2,a:'a'}];
            arrays.group_rows_by(rowset, ['x']).should.deep.equal({
                1 : {y:1,a:'a'}, 
                2 : {y:1,a:'b'}, 
                3 : {y:4,a:'a'}, 
                4 : {y:2,a:'a'}
            });
        });
        it('Should group by multiple attributes.', function(){
            var rowset=[{x:1,y:1,a:'a'}, {x:2,y:1,a:'b'}, {x:3,y:4,a:'a'}, {x:4,y:2,a:'a'}];
            arrays.group_rows_by(rowset, ['y', 'x']).should.deep.equal({
                1:{
                    1:{a:'a'}, 
                    2:{a:'b'}
                },
                4:{3:{a:'a'}}, 
                2:{4:{a:'a'}}
            });
        });
        it('If keep_keys is thruthy, should not delete the attributes.', function(){
            var rowset=[{x:1,y:1,a:'a'}, {x:2,y:1,a:'b'}, {x:3,y:4,a:'a'}, {x:4,y:2,a:'a'}];
            arrays.group_rows_by(rowset, ['y', 'x'], {keep_keys:true}).should.deep.equal({
                1:{
                    1:{x:1,y:1,a:'a'}, 
                    2:{x:2,y:1,a:'b'}
                }, 
                4:{3:{x:3,y:4,a:'a'}}, 
                2:{4:{x:4,y:2,a:'a'}}
            });
        });
        it('Should collapse rows if collapse_single_leaves is thruthy and they end up with one key.', function(){
            var rowset=[{x:1,y:1,a:'a'}, {x:2,y:1,a:'b'}, {x:3,y:4,a:'a'}, {x:4,y:2,a:'a'}];
            arrays.group_rows_by(rowset, ['y', 'x'], {collapse_single_leaves:true}).should.deep.equal({
                1:{
                    1:'a', 
                    2:'b'
                }, 
                4:{3:'a'}, 
                2:{4:'a'}
            });
        });
        it('Should not collapse rows if collapse_single_leaves is thruthy but rows dont have one key.', function(){
            var rowset=[{x:1,y:1,a:'a'}, {x:2,y:1,a:'b'}, {x:3,y:4,a:'a'}, {x:4,y:2,a:'a'}];
            arrays.group_rows_by(rowset, ['y'], {collapse_single_leaves:true}).should.deep.equal({
                1:{x:2, a:'b'}, 
                4:{x:3, a:'a'}, 
                2:{x:4, a:'a'}
            });
        });
        it('Rows falling in the grouping get overwritten.', function(){
            var rowset=[{x:1,y:1,a:'a'}, {x:2,y:1,a:'b'}, {x:3,y:4,a:'a'}, {x:4,y:2,a:'a'}];
            arrays.group_rows_by(rowset, ['y']).should.deep.equal({
                1:{x:2, a:'b'}, 
                4:{x:3, a:'a'}, 
                2:{x:4, a:'a'}
            });
        });
        it('Should do nothing if no grouping attributes is falsey.', function(){
            var rowset=[{x:1,y:1,a:'a'}, {x:2,y:1,a:'b'}, {x:3,y:1,a:'a'}, {x:4,y:2,a:'a'}];
            arrays.group_rows_by(rowset, false).should.equal(rowset);
        });
    });
});
