/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var sinon = require('sinon');
var rewire= require('rewire');
var router_expect = require('../../../mock_tools/router_expect');

var sites = rewire('../../../../app/routes/data-api/sites');

var mock = {
    model:{
        sites:{}
    }
};
sites.__set__(mock);

var sites_router = router_expect(sites, {
    session:{user:{id:9393, isSuper:1}}
});


describe('sites.js', function(){
    afterEach(function(){
        mock.model.sites={};
    });
    describe('GET /published', function() {
        it('Should respond with list of published sites.', function(done){
            mock.model.sites.listPublished = function(cb){ setImmediate(cb, null, ["published-site-1","published-site-2"]);};
            sites_router.when('/published', { json: function(req, res, obj){
                obj.should.deep.equal(["published-site-1","published-site-2"]);
                done();
            }});
        });
        it('Should fail if fetching list of published sites failed.', function(done){
            mock.model.sites.listPublished = function(cb){ setImmediate(cb, new Error("I am error"));};
            sites_router.when('/published', { next: function(req, res, err){
                should.exist(err);
                err.message.should.equal("I am error");
                done();
            }});
        });
    });
});
