/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";

var chai = require('chai'), should = chai.should(), expect = chai.expect;
var sinon = require('sinon');
var q = require('q');
var rewire = require('rewire');

var mock_config = {};

var aws_s3={};
var mock = {
    config : function(attr){ return mock_config[attr]; },
    aws : { S3: function(){
        return aws_s3;
    }},
};

var AppListings = rewire('../../app/model/app-listings');
AppListings.__set__(mock);

describe('AppListings', function(){
    describe('getListFor', function(){
        beforeEach(function(){
            sinon.stub(AppListings, 'fetchCache');
            AppListings.fetchCache.returns(q.resolve({
                list:{'app-1' : ['1', '2']}
            }));
        });
        afterEach(function(){
            AppListings.fetchCache.restore();
        });
        it('Should return the app listing from the cache.', function(done){
            AppListings.getListFor('app-1').then(function(appList){
                AppListings.fetchCache.callCount.should.equal(1);
                appList.should.deep.equal(['1', '2']);
                done();
            }).catch(done);
        });
        it('Should return empty list if the app is not in the cache.', function(done){
            AppListings.getListFor('app-2').then(function(appList){
                AppListings.fetchCache.callCount.should.equal(1);
                appList.should.deep.equal([]);
                done();
            }).catch(done);
        });
    });

    describe('fetchCache', function(){
        beforeEach(function(){
            aws_s3 = {listObjects:sinon.stub()};
            mock_config = {
                aws: { bucketName:'bucket' }
            };
            aws_s3.listObjects.yields(null, {
                Contents:[
                    {Key:'software/app-1/app-1-0.0.1.deb'},
                    {Key:'software/app-1/app-1-0.0.1.dmg'},
                    {Key:'software/app-1/app-1-0.0.1.msi'},
                ]
            });
        });
        afterEach(function(){
            aws_s3 = {};
            mock_config = {};
            AppListings.cache = undefined;
        });
        it('Should fetch the apps and store them in a cache.', function(done){
            AppListings.fetchCache().then(function(cache){
                aws_s3.listObjects.callCount.should.equal(1);
                cache.should.deep.equal({
                    expires: cache.expires,
                    list: {
                        'app-1': [{
                            url : 'https://bucket.s3.amazonaws.com/software/app-1/app-1-0.0.1.deb',
                            file : 'app-1-0.0.1.deb',
                            version : '0.0.1',
                            type : 'linux'
                        }, {
                            url : 'https://bucket.s3.amazonaws.com/software/app-1/app-1-0.0.1.dmg',
                            file : 'app-1-0.0.1.dmg',
                            version : '0.0.1',
                            type : 'osx'
                        }, {
                            url : 'https://bucket.s3.amazonaws.com/software/app-1/app-1-0.0.1.msi',
                            file : 'app-1-0.0.1.msi',
                            version : '0.0.1',
                            type : 'windows'
                        }]
                    }
                });
                done();
            }).catch(done);
        });
        it('If cache is fresh, then fetch is skipped.', function(done){
            var freshCache = {expires:new Date().getTime() + 3 * 60 * 60 * 1000, list:{}};
            AppListings.cache = freshCache;
            AppListings.fetchCache().then(function(cache){
                aws_s3.listObjects.callCount.should.equal(0);
                cache.should.equal(freshCache);
                done();
            }).catch(done);
        });
    });

});
