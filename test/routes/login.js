/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var sinon = require('sinon');

var routes = require('../../routes/login');

describe('index.js', function(){
    describe('use haveAccess middleware', function(){
        it('Should append the have access function to the request object.', function(done){
            var req, res;
            routes.handle(req={method:'get', url:'/some-exotic-url-link'}, res={}, function(err){
                should.exist(req.haveAccess);
                done();
            });
        });
        it('Should allow access on a project if the user has permissions for it.', function(done){
            var req, res;
            routes.handle(req={method:'get', url:'/some-exotic-url-link', session:{user:{
                isSuper:0,
                permissions:{
                    1:[{name:'do the hooky pooky'}, {name:'jump around'}]
                }
            }}}, res={}, function(err){
                should.exist(req.haveAccess);
                req.haveAccess(1, 'do the hooky pooky').should.equal(true);
                req.haveAccess(1, 'jump around').should.equal(true);
                done();
            });
        });
        it('Should deny access on a project if the user has no role in it.', function(done){
            var req, res;
            routes.handle(req={method:'get', url:'/some-exotic-url-link', session:{user:{
                isSuper:0,
                permissions:{}
            }}}, res={}, function(err){
                should.exist(req.haveAccess);
                req.haveAccess(1, 'do the hooky pooky').should.equal(false);
                req.haveAccess(1, 'jump around').should.equal(false);
                done();
            });
        });
        it('Should allow any access on any project to a super user.', function(done){
            var req, res;
            routes.handle(req={method:'get', url:'/some-exotic-url-link', session:{user:{isSuper:1}}}, res={}, function(err){
                should.exist(req.haveAccess);
                req.haveAccess(1, 'do anything even non-exitent things').should.equal(true);
                done();
            });
        });
    });
    describe('get /api/login_available', function(){
    });
    describe('get /api/email_available', function(){
    });
    describe('get / and /login', function(){
    });
    describe('post /login', function(){
    });
    describe('get /logout', function(){
    });
    describe('get /register', function(){
    });
    describe('get /activate/:hash', function(){
    });
    describe('post /register', function(){
    });
    describe('get /forgot_request', function(){
    });
    describe('post /forgot_request', function(){
    });
    describe('get /reset_password/:hash', function(){
    });
    describe('post /reset_password/:hash', function(){
    });        
});
