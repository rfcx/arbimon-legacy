/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var sinon = require('sinon');
var q = require('q');
var rewire= require('rewire');
var events = require('events');
var sha256 = require('../../../../app/utils/sha256');
var router_expect = require('../../../mock_tools/router_expect');
var router_expect2 = require('../../../mock_tools/router_expect2');
var user = rewire('../../../../app/routes/data-api/user');
var cl = console.log;
var mock = {
    gravatar:{
        url: function() { return 'gravatar_image.png'; }
    },
    model:{
        projects:{},
        users:{},
        news:{}
    }
};
user.__set__(mock);

var user_router = router_expect(user, { session: { user: { id:9393 } } });

describe('routes/data-api/user.js', function(){
    var userRouter2;
    
    before(function() {
        userRouter2 = router_expect2(user, { 
            session: { 
                user: { 
                    id: 9393,
                } 
            } 
        });
    });
    
    beforeEach(function(){
        mock.model.news={};
        mock.model.projects={};
        mock.model.users={};
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
        var req;
        
        beforeEach(function() {
            req = { url:'/feed/1', params: { page: 1 }};
        });
        
        
        it('Should return a feed of events for the user.', function(done){
            var time = new Date();
            mock.model.news.getNewsTypeFormats = function(cb){
                return q.resolve([{id:1, message_format:"mf1"}]).nodeify(cb);
            };
            mock.model.news.userFeed = function(uid, page, cb) {
                return q.resolve([{
                    data: '{}',
                    username: 'user',
                    email: 'user@site.com',
                    timestamp: time,
                    project: 'some project',
                    type: 1
                }]).nodeify(cb);
            };
            
            var res = {
                json: [
                    [{
                        type: 1,
                        data:{
                            project: [
                                undefined,
                                'some project'
                            ]
                        },
                        username: 'user',
                        timestamp: time,
                        imageUrl: "gravatar_image.png"
                    }]
                ]
            };
            userRouter2.whenExpect(req, res, done);
        });
        
        it('Should fail if getting the news fail.', function(done){
            var time = new Date();
            mock.model.news.getNewsTypeFormats = function(cb){cb(new Error('I am error'));};
            mock.model.news.userFeed = function(uid, page, cb) {
                cb(null, [{
                    data: '{}',
                    username: 'user',
                    email: 'user@site.com',
                    timestamp: time,
                    project: 'some project',
                    type: 1
                }]);
            };
            
            var res = { next: [new Error('I am error')] };
            userRouter2.whenExpect(req, res, done);
        });
        
        it('Should fail if getting the news type formats fail.', function(done){
            mock.model.news.getNewsTypeFormats = function(cb){cb(null, [{id:1, message_format:"mf1"}]);};
            mock.model.news.userFeed = function(uid, page, cb){cb(new Error('I am error'));};
            
            var res = { next: [new Error('I am error')] };
            userRouter2.whenExpect(req, res, done);
        });
    });
    describe('get /info', function(){
        it('Should return the user info associated with the current session.', function(done){
            user_router.when({url:'/info',session:{
                user:{username:'pepe',email:'pepe@site.com',firstname:'Pepe',lastname:'User'}
            }}, { json: function(req, res, obj){
                should.exist(obj);
                obj.should.deep.equal({
                    username:'pepe',
                    email:'pepe@site.com',
                    name:'Pepe',
                    lastname:'User',
                    imageUrl: undefined,
                    isAnonymousGuest: undefined,
                    oauth: undefined,
                });
                done();
            }});
        });
    });
    describe('get /search/:query', function(){
        it('Should return the set of users matching the given query.', function(done){
            mock.model.users.search = function(q, cb){ cb(null, [{username:'pepe',email:'pepe@site.com',firstname:'Pepe',lastname:'User'}]); };
            user_router.when({url:'/search/pepe',_params:{query:'pepe'}}, { json: function(req, res, obj){
                should.exist(obj);
                obj.should.deep.equal([{username:'pepe',email:'pepe@site.com',firstname:'Pepe',lastname:'User',imageUrl:'gravatar_image.png'}]);
                done();
            }});
        });
        it('Should fail if user search fails.', function(done){
            mock.model.users.search = function(q, cb){ cb(new Error("I am error")); };
            user_router.when({url:'/search/pepe',_params:{query:'pepe'}}, { next: function(req, res, err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            }});
        });
        it('Should return error if query is empty.', function(done){
            user_router.when({url:'/search/' }, { json: function(req, res, obj){
                should.exist(obj);
                obj.should.deep.equal({error:'empty query'});
                done();
            }});
        });

    });
    describe('post /update/password', function(){
        it('Should update a logged user\'s password, if given password matches.', function(done){
            mock.model.users.findById = function(q, cb){ cb(null, [{username:'pepe',email:'pepe@site.com',firstname:'Pepe',lastname:'User', password:sha256('oldpass')}]); };
            mock.model.users.update = sinon.spy(function(_, cb){ cb(null);});
            user_router.when({url:'/update/password',method:"POST", session:{user:{id:9393}}, body:{userData:{newPass:'newpass'},password:"oldpass"}}, { json: function(req, res, obj){
                mock.model.users.update.calledOnce.should.be.true;
                should.exist(obj);
                obj.should.deep.equal({message:'success! password updated'});
                done();
            }});
        });
        it('Should respond with failure if parameters are missing.', function(done){
            mock.model.users.update = sinon.spy(function(_, cb){ cb(null);});
            user_router.when({url:'/update/password',method:"POST", session:{user:{id:9393}}, body:{}}, { json: function(req, res, obj){
                mock.model.users.update.calledOnce.should.be.false;
                should.exist(obj);
                obj.should.deep.equal({error:'missing parameters'});
                done();
            }});
        });
        it('Should respond with failure if given password does not match.', function(done){
            mock.model.users.findById = function(q, cb){ cb(null, [{username:'pepe',email:'pepe@site.com',firstname:'Pepe',lastname:'User', password:sha256('oldpass')}]); };
            mock.model.users.update = sinon.spy(function(_, cb){ cb(null);});
            user_router.when({url:'/update/password',method:"POST", session:{user:{id:9393}}, body:{userData:{newPass:'newpass'},password:"oldpassblah"}}, { json: function(req, res, obj){
                mock.model.users.update.calledOnce.should.be.false;
                should.exist(obj);
                obj.should.deep.equal({error: "invalid password"});
                done();
            }});
        });
        it('Should fail if update fails.', function(done){
            mock.model.users.findById = function(q, cb){ cb(null, [{username:'pepe',email:'pepe@site.com',firstname:'Pepe',lastname:'User', password:sha256('oldpass')}]); };
            mock.model.users.update = sinon.spy(function(_, cb){ cb(new Error('I am error'));});
            user_router.when({url:'/update/password',method:"POST", session:{user:{id:9393}}, body:{userData:{newPass:'newpass'},password:"oldpass"}}, { next: function(req, res, err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            }});
        });
        it('Should fail if user search fails.', function(done){
            mock.model.users.findById = function(q, cb){ cb(new Error('I am error')); };
            user_router.when({url:'/update/password',method:"POST", session:{user:{id:9393}}, body:{userData:{newPass:'newpass'},password:"oldpass"}}, { next: function(req, res, err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            }});
        });
    });
    describe('post /update', function(){
        it('Should update a logged user\'s firstname and lastname, if given password matches.', function(done){
            mock.model.users.findById = function(_, cb){ return q.resolve([{username:'pepe',email:'pepe@site.com',firstname:'Pepe',lastname:'User', password:sha256('oldpass')}]); };
            mock.model.users.update = sinon.spy(function(_, cb){ return q.resolve();});
            mock.model.users.hashPassword = sinon.spy(function(_){ return sha256(_); });
            mock.model.users.makeUserObject = sinon.spy(function(_){ return {qwerty:1234}; });
            user_router.when({url:'/update',method:"POST", session:{user:{id:9393}}, body:{userData:{name:'Papo',lastname:'Maleante'},password:"oldpass"}}, { 
                type: function(req, res, t){
                    t.should.equal('json');
                },
                next: function(req, res, obj){
                    done(obj);
                },
                json: function(req, res, obj){
                    mock.model.users.update.calledOnce.should.be.true;
                    should.exist(obj);
                    obj.should.deep.equal({message:'User data updated.'});
                    done();
                }
            });
        });
        it('Should respond with failure if parameters are missing.', function(done){
            mock.model.users.update = sinon.spy(function(_, cb){ cb(null);});
            user_router.when({url:'/update/name',method:"POST", session:{user:{id:9393}}, body:{}}, { json: function(req, res, obj){
                mock.model.users.update.calledOnce.should.be.false;
                should.exist(obj);
                obj.should.deep.equal({error:'missing parameters'});
                done();
            }});
        });
        it('Should respond with failure if given password does not match.', function(done){
            mock.model.users.findById = function(_, cb){ return q.resolve([{username:'pepe',email:'pepe@site.com',firstname:'Pepe',lastname:'User', password:sha256('oldpass')}]); };
            mock.model.users.update = sinon.spy(function(_, cb){ return q.resolve();});
            mock.model.users.hashPassword = sinon.spy(function(_){ return sha256(_); });
            mock.model.users.makeUserObject = sinon.spy(function(_){ return {qwerty:1234}; });
            user_router.when({url:'/update',method:"POST", session:{user:{id:9393}}, body:{userData:{name:'Papo',lastname:'Maleante'},password:"oldpassblah"}}, { 
                type: function(req, res, t){
                    t.should.equal('json');
                },
                next: function(req, res, obj){
                    obj.should.deep.equal({
                        message:{ error: "Invalid confirmation password" },
                        status: 200
                    });
                    done();
                }
            });
        });
        it('Should fail if update fails.', function(done){
            mock.model.users.findById = function(_, cb){ return q.resolve([{username:'pepe',email:'pepe@site.com',firstname:'Pepe',lastname:'User', password:sha256('oldpass')}]); };
            mock.model.users.update = sinon.spy(function(_, cb){ return q.reject(new Error('I am error'));});
            mock.model.users.hashPassword = sinon.spy(function(_){ return sha256(_); });
            mock.model.users.makeUserObject = sinon.spy(function(_){ return {qwerty:1234}; });
            user_router.when({url:'/update',method:"POST", session:{user:{id:9393}}, body:{userData:{name:'Papo',lastname:'Maleante'},password:"oldpass"}}, { 
                type: function(req, res, t){
                    t.should.equal('json');
                },
                next: function(req, res, err){
                    should.exist(err);
                    err.message.should.equal('I am error');
                    done();
                }
            });
        });
        it('Should fail if user search fails.', function(done){
            mock.model.users.findById = function(_, cb){ return q.reject(new Error('I am error')); };
            user_router.when({url:'/update',method:"POST", session:{user:{id:9393}}, body:{userData:{name:'Papo',lastname:'Maleante'},password:"oldpass"}}, { 
                type: function(req, res, t){
                    t.should.equal('json');
                },
                next: function(req, res, err){
                    should.exist(err);
                    err.message.should.equal('I am error');
                    done();
                }
            });
        });
    });
});
