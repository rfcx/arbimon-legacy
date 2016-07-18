/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var sinon = require('sinon');
var rewire= require('rewire');
var events = require('events');
var router_expect = require('../../mock_tools/router_expect');
var dd=console.log;
var species = rewire('../../../app/routes/data-api/species');

var mock = {
    model:{
        species:{}
    }
};
species.__set__(mock);

var species_router = router_expect(species);

describe('species.js', function(){
    afterEach(function(){
        mock.model.species={};
    });
    describe('GET /list/:limit', function(){
        it('Should return a list of species.', function(done){
            mock.model.species.list = function(limit, cb){cb(null, [{speciesId:5932135, name:'cua cua'}]);};
            species_router.when({url:'/list/1', _params:{limit:'1'}}, { json: function(req, res, obj){
                should.exist(obj);
                obj.should.deep.equal([{speciesId:5932135, name:'cua cua'}]);
                done();
            }});
        });
        it('Should fail if there was any error.', function(done){
            mock.model.species.list = function(limit, cb){cb(new Error("I am error"));};
            species_router.when({url:'/list/1', _params:{limit:'1'}}, { next: function(req, res, err){
                should.exist(err);
                err.message.should.equal("I am error");
                done();
            }});
        });
    });
    describe('GET /search', function(){
        it('Should respond with list of species matching the given query.', function(done){
            mock.model.species.search = function(id, cb){cb(null, [{speciesId:5932135, name:'cua cua'}]);};
            species_router.when({url:'/search', query:{q:'cua'}}, { json: function(req, res, obj){
                should.exist(obj);
                obj.should.deep.equal([{speciesId:5932135, name:'cua cua'}]);
                done();
            }});
        });
        it('Should fail if there was any error.', function(done){
            mock.model.species.search = function(id, cb){cb(new Error("I am error"));};
            species_router.when('/search', { next: function(req, res, err){
                should.exist(err);
                err.message.should.equal("I am error");
                done();
            }});
        });
    });
    describe('GET /:speciesId', function() {
        it('Should respond a species details given its id.', function(done){
            mock.model.species.findById = function(id, cb){cb(null, [{speciesId:5932135, name:'cua cua'}]);};
            species_router.when('/5932135', { json: function(req, res, obj){
                should.exist(req.species);
                req.species.should.deep.equal({speciesId:5932135, name:'cua cua'});
                req.species.should.equal(obj);
                done();
            }});
        });
        it('Should respond 404 if species is not found.', function(done){
            mock.model.species.findById = function(id, cb){cb(null, []);};
            species_router.when('/5932135', { status:true, json: function(req, res, obj){
                res.status.calledOnce.should.be.true;
                res.status.args[0].should.deep.equal([404]);
                obj.should.deep.equal({ error: "species not found"});
                done();
            }});
        });
        it('Should fail if species cannot be found.', function(done){
            mock.model.species.findById = function(id, cb){cb(new Error("I am error"));};
            species_router.when({url:'/5932135'}, { next: function(req, res, err){
                should.exist(err);
                err.message.should.equal("I am error");
                done();
            }});
        });
    });
});
