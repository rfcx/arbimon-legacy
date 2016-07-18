/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";

var q = require('q');
var chai = require('chai'), should = chai.should(), expect = chai.expect;
var sinon = require('sinon');
var rewire= require('rewire');
var router_expect = require('../../../mock_tools/router_expect');

var AppListings = rewire('../../../../app/routes/data-api/app-listings');

var mock = {
    models:{
        AppListings:{}
    }
};
AppListings.__set__(mock);

var AppListingsRouter = router_expect(AppListings, {
    session:{user:{id:9393, isSuper:1}}
});


describe('app-listings.js', function(){
    afterEach(function(){
        mock.models.AppListings={};
    });
    describe('GET /:appname?', function() {
        it('Should respond with list of programs for the given app.', function(done){
            mock.models.AppListings.getListFor = sinon.stub();
            mock.models.AppListings.getListFor.returns(q.resolve(['1', '2']));
            
            AppListingsRouter.when('/app-name-1', { json: function(req, res, obj){
                obj.should.deep.equal(['1', '2']);
                mock.models.AppListings.getListFor.callCount.should.equal(1);
                mock.models.AppListings.getListFor.args[0].should.deep.equal([
                    'app-name-1'
                ]);
                done();
            }});
        });
        it('Should fail if fetching app listings failed.', function(done){
            mock.models.AppListings.getListFor = sinon.stub();
            mock.models.AppListings.getListFor.returns(q.reject(new Error("I am error")));
            
            AppListingsRouter.when('/app-name-1', { next: function(req, res, err){
                should.exist(err);
                err.message.should.equal("I am error");
                done();
            }});
        });
    });
});
