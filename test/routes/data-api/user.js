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
var user = rewire('../../../routes/data-api/user');

var mock = {
    gravatar:{url:function(){return 'gravatar_image.png';}},
    model:{
        projects:{},
        users:{},
        news:{}
    }
};
user.__set__(mock);

var user_router = router_expect(user,{session:{user:{id:9393}}});

describe('user.js', function(){
    afterEach(function(){
        mock.model.news={};
        mock.model.projects={};
        mock.model.user={};
    });
    
    describe('get /projectlist', function(){
        it('Should return a list of projects visible to this user.', function(done){
            mock.model.users.projectList = function(uid, cb){cb(null, [{project_id:1, name:"p1"}]);};
            user_router.when('/projectlist', { json: function(req, res, obj){
                should.exist(obj);
                obj.should.deep.equal([{project_id:1, name:"p1"}]);
                done();
            }});
        });
        it('Should fail if there was any error.', function(done){
            mock.model.users.projectList = function(uid, cb){cb(new Error("I am error"));};
            user_router.when('/projectList', { next: function(req, res, err){
                should.exist(err);
                err.message.should.equal("I am error");
                done();
            }});
        });
        it('Should return a list of all projects if user is super.', function(done){
            mock.model.projects.listAll = function(cb){cb(null, [{project_id:1, name:"p1"}]);};
            user_router.when({url:'/projectlist', session:{user:{isSuper:1}}}, { json: function(req, res, obj){
                should.exist(obj);
                obj.should.deep.equal([{project_id:1, name:"p1"}]);
                done();
            }});
        });
        it('Should fail if there was any error fetching all the projects.', function(done){
            mock.model.projects.listAll = function(cb){cb(new Error("I am error"));};
            user_router.when({url:'/projectlist', session:{user:{isSuper:1}}}, { next: function(req, res, err){
                should.exist(err);
                err.message.should.equal("I am error");
                done();
            }});
        });
    });
    describe('get /feed/:page', function(){
        it('Should return a feed of events for the user.', function(done){
            mock.model.news.newsTypesFormat = function(cb){cb(null, [{id:1, message_format:"mf1"}]);};
            mock.model.news.userFeed = function(uid, page, cb){cb(null, [{email:'a@b.c', data:"{}", project:1, type:1}]);};
            user_router.when({url:'/feed/1',params:{page:1}}, { json: function(req, res, obj){
                should.exist(obj);
                obj.should.deep.equal([{email:'a@b.c', data:"{}", project:1, type:1, message:"mf1", imageUrl:"gravatar_image.png"}]);
                done();
            }});
        });
        it('Should fail if getting the news fail.', function(done){
            mock.model.news.newsTypesFormat = function(cb){cb(new Error('I am error'));};
            mock.model.news.userFeed = function(uid, page, cb){cb(null, [{email:'a@b.c', data:"{}", project:1, type:1}]);};
            user_router.when({url:'/feed/1',params:{page:1}}, { next: function(req, res, err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            }});
        });
        it('Should fail if getting the news type formats fail.', function(done){
            mock.model.news.newsTypesFormat = function(cb){cb(null, [{id:1, message_format:"mf1"}]);};
            mock.model.news.userFeed = function(uid, page, cb){cb(new Error('I am error'));};
            user_router.when({url:'/feed/1',params:{page:1}}, { next: function(req, res, err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            }});
        });
    });
    describe('get /info', function(){
    });
    describe('get /search/:query', function(){
    });
    describe('post /update/password', function(){
    });
    describe('post /update/name', function(){
    });
});
