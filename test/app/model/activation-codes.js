/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";

var chai = require('chai'), should = chai.should(), expect = chai.expect;
var sinon = require('sinon');
var q = require('q');
var mock_mysql = require('../../mock_tools/mock_mysql');
var rewire = require('rewire');

var dbpool = rewire('../../../app/utils/dbpool');
dbpool.__set__({mysql : mock_mysql});
dbpool.pool = mock_mysql.createPool(true);
var ActivationCodes = rewire('../../../app/model/activation-codes');
function mockSha256(){
    var args = Array.prototype.slice.call(arguments);
    return mockSha256.mock && mockSha256.mock.apply(null, args);
}
ActivationCodes.__set__({
    dbpool : dbpool,
    sha256 : mockSha256
});
describe('ActivationCodes', function(){
    describe('listAll', function(){
        beforeEach(function(){
            mock_mysql.pool.cache = {};
        });
        it('should resolve to list of activation codes', function(done){
            mock_mysql.pool.cache[
                "SELECT activation_code_id as id, hash, created, creator, payload, consumed, consumer, project\n" +
                "FROM activation_codes"
            ] = {value:[{a:1,b:2,c:3,payload:"[1]"}]};
            ActivationCodes.listAll().then(function(data){
                expect(data).to.exist;
                data.should.deep.equal([{a:1,b:2,c:3,payload:[1]}]);
            }).then(done, done);
        });
        it('should filter by hash, if given one', function(done){
            mock_mysql.pool.cache[
                "SELECT activation_code_id as id, hash, created, creator, payload, consumed, consumer, project\n" +
                "FROM activation_codes\n" +
                "WHERE (hash = ?)"
            ] = {value:[{a:1,b:2,c:3,payload:"[1]"}]};
            ActivationCodes.listAll({
                hash:'~!1:1!~',
            }).then(function(data){
                expect(data).to.exist;
                data.should.deep.equal([{a:1,b:2,c:3,payload:[1]}]);
            }).then(done, done);
        });
        it('should filter by consumed, if given one', function(done){
            mock_mysql.pool.cache[
                "SELECT activation_code_id as id, hash, created, creator, payload, consumed, consumer, project\n" +
                "FROM activation_codes\n" +
                "WHERE (consumed = ?)"
            ] = {value:[{a:1,b:2,c:3,payload:"[1]"}]};
            ActivationCodes.listAll({
                consumed:true
            }).then(function(data){
                expect(data).to.exist;
                data.should.deep.equal([{a:1,b:2,c:3,payload:[1]}]);
            }).then(done, done);
        });
        it('should filter by consumer, if given one', function(done){
            mock_mysql.pool.cache[
                "SELECT activation_code_id as id, hash, created, creator, payload, consumed, consumer, project\n" +
                "FROM activation_codes\n" +
                "WHERE (consumer = ? OR consumer IS NULL)"
            ] = {value:[{a:1,b:2,c:3,payload:"[1]"}]};
            ActivationCodes.listAll({
                consumer:101
            }).then(function(data){
                expect(data).to.exist;
                data.should.deep.equal([{a:1,b:2,c:3,payload:[1]}]);
            }).then(done, done);
        });
        it('Filter by consumer can be strict', function(done){
            mock_mysql.pool.cache[
                "SELECT activation_code_id as id, hash, created, creator, payload, consumed, consumer, project\n" +
                "FROM activation_codes\n" +
                "WHERE (consumer = ?)"
            ] = {value:[{a:1,b:2,c:3,payload:"[1]"}]};
            ActivationCodes.listAll({
                consumer:101, strict:true,
            }).then(function(data){
                expect(data).to.exist;
                data.should.deep.equal([{a:1,b:2,c:3,payload:[1]}]);
            }).then(done, done);
        });
        it('should filter by project, if given one', function(done){
            mock_mysql.pool.cache[
                "SELECT activation_code_id as id, hash, created, creator, payload, consumed, consumer, project\n" +
                "FROM activation_codes\n" +
                "WHERE (project = ? OR project IS NULL)"
            ] = {value:[{a:1,b:2,c:3,payload:"[1]"}]};
            ActivationCodes.listAll({
                project:101
            }).then(function(data){
                expect(data).to.exist;
                data.should.deep.equal([{a:1,b:2,c:3,payload:[1]}]);
            }).then(done, done);
        });
        it('Filter by project can be strict', function(done){
            mock_mysql.pool.cache[
                "SELECT activation_code_id as id, hash, created, creator, payload, consumed, consumer, project\n" +
                "FROM activation_codes\n" +
                "WHERE (project = ?)"
            ] = {value:[{a:1,b:2,c:3,payload:"[1]"}]};
            ActivationCodes.listAll({
                project:101, strict:true,
            }).then(function(data){
                expect(data).to.exist;
                data.should.deep.equal([{a:1,b:2,c:3,payload:[1]}]);
            }).then(done, done);
        });
    });
    describe('makeHash', function(){
        beforeEach(function(){
            mockSha256.mock = sinon.mock();
            mockSha256.mock.returns('meh...!.!');
        });
        it('should return a hash of the given data parameters', function(){
            var data = {
                processing : 1,
                recordings : 2,
                user : 3,
                project : 4,
            };
            expect(ActivationCodes.makeHash(data)).to.equal('meh...!.!');
            mockSha256.mock.callCount.should.equal(1);
            var m = /^(\d+)(.+)(\d+\.\d+)$/.exec(mockSha256.mock.args[0][0]);
            expect(m).to.exist;
            m[2].should.equal(JSON.stringify([
                (data.processing | 0),
                (data.recordings | 0),
                (data.user | 0),
                (data.project | 0),
            ]));
        });
    });
    describe('createCode', function(){
        beforeEach(function(){
            mock_mysql.pool.cache = {};
            mockSha256.mock = sinon.mock();
            mockSha256.mock.returns('meh...!.!');
        });
        it('should add an activation code to the database', function(done){
            mock_mysql.pool.cache[
                "INSERT INTO activation_codes(hash, created, creator, payload, consumed, consumer, project)\n"+
                "VALUES (?, NOW(), ?, ?, 0, ?, ?)"
            ] = {value:{insertId:1101}};
            ActivationCodes.createCode({id:1}, {
                processing : 1,
                recordings : 2,
                user : 3,
                project : 4,
            }).then(function(data){
                expect(data).to.exist;
                data.should.deep.equal({insertId:1101});
            }).then(done, done);
        });
        it('user is optional', function(done){
            mock_mysql.pool.cache[
                "INSERT INTO activation_codes(hash, created, creator, payload, consumed, consumer, project)\n"+
                "VALUES (?, NOW(), ?, ?, 0, ?, ?)"
            ] = {value:{insertId:1101}};
            ActivationCodes.createCode({id:1}, {
                processing : 1,
                recordings : 2,
                project : 4,
            }).then(function(data){
                expect(data).to.exist;
                data.should.deep.equal({insertId:1101});
            }).then(done, done);
        });
        it('project is optional', function(done){
            mock_mysql.pool.cache[
                "INSERT INTO activation_codes(hash, created, creator, payload, consumed, consumer, project)\n"+
                "VALUES (?, NOW(), ?, ?, 0, ?, ?)"
            ] = {value:{insertId:1101}};
            ActivationCodes.createCode({id:1}, {
                processing : 1,
                recordings : 2,
                user : 3,
            }).then(function(data){
                expect(data).to.exist;
                data.should.deep.equal({insertId:1101});
            }).then(done, done);
        });
    });
    describe('consumeCode', function(){
        beforeEach(function(){
            mock_mysql.pool.cache = {};
        });
        it('should consume an activation code', function(done){
            mock_mysql.pool.cache[
                "UPDATE activation_codes\n"+
                "SET consumed=1, consumer=?\n"+
                "WHERE activation_code_id=?"
            ] = {value:{affectedRows:1}};
            ActivationCodes.consumeCode(1, {id:1112}).then(function(data){
                expect(data).to.exist;
                data.should.deep.equal({affectedRows:1});
            }).then(done, done);
        });
    });
});
