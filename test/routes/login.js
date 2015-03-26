/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var sinon = require('sinon');
var rewire= require('rewire');

var login = rewire('../../routes/login');

var mock = {
    sha256: function(x){return '!'+x+'!';},
    request: function(url, callback){
        if(mock.request.delegate){
            mock.request.delegate(url, callback);
        } else {
            setImmediate(callback, new Error("cannot send request " + JSON.stringify(url)));
        }
    },
    model:{
        users:{}
    }
};
login.__set__(mock)

describe('index.js', function(){
    beforeEach(function(){
        mock.model.users={};
        delete mock.request.delegate;
    })
    describe('use haveAccess middleware', function(){
        it('Should append the have access function to the request object.', function(done){
            var req, res;
            login.handle(req={method:'get', url:'/some-exotic-url-link'}, res={}, function(err){
                should.exist(req.haveAccess);
                done();
            });
        });
        it('Should allow access on a project if the user has permissions for it.', function(done){
            var req, res;
            login.handle(req={method:'get', url:'/some-exotic-url-link', session:{user:{
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
            login.handle(req={method:'get', url:'/some-exotic-url-link', session:{user:{
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
            login.handle(req={method:'get', url:'/some-exotic-url-link', session:{user:{isSuper:1}}}, res={}, function(err){
                should.exist(req.haveAccess);
                req.haveAccess(1, 'do anything even non-exitent things').should.equal(true);
                done();
            });
        });
    });
    describe('get /api/login_available', function(){
        it('Should indicate wether a given login is available or not.', function(done){
            mock.model.users.usernameInUse=function(name, cb){
                cb(null, false);
            };
            var req, res;
            login.handle(req={
                method:'get', url:'/api/login_available', query:{username:'pepe'}
            }, res={
                json:function(obj){
                    obj.should.deep.equal({available:true});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should respond error message if parameter is missing.', function(done){
            var req, res;
            login.handle(req={
                method:'get', url:'/api/login_available', query:{}
            }, res={
                json:function(obj){
                    obj.should.deep.equal({error: "missing parameter"});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should relay error message to router if checking failed.', function(done){
            mock.model.users.usernameInUse=function(name, cb){
                cb(new Error("I am error"));
            };
            var req, res;
            login.handle(req={
                method:'get', url:'/api/login_available', query:{username:'pepe'}
            }, res={
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
    });
    describe('get /api/email_available', function(){
        it('Should indicate wether a given email is available or not.', function(done){
            mock.model.users.emailInUse=function(name, cb){
                cb(null, false);
            };
            var req, res;
            login.handle(req={
                method:'get', url:'/api/email_available', query:{email:'pepe@site.com'}
            }, res={
                json:function(obj){
                    obj.should.deep.equal({available:true});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should respond error message if email parameter is not valid.', function(done){
            var req, res;
            login.handle(req={
                method:'get', url:'/api/email_available', query:{email:'invalidemail!#$'}
            }, res={
                json:function(obj){
                    obj.should.deep.equal({invalid:true});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should respond error message if parameter is missing.', function(done){
            var req, res;
            login.handle(req={
                method:'get', url:'/api/email_available', query:{}
            }, res={
                json:function(obj){
                    obj.should.deep.equal({error: "missing parameter"});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should relay error message to router if checking failed.', function(done){
            mock.model.users.emailInUse=function(name, cb){
                cb(new Error("I am error"));
            };
            var req, res;
            login.handle(req={
                method:'get', url:'/api/email_available', query:{email:'pepe@site.com'}
            }, res={
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
    });
    describe('get /', function(){
        it('Should show the login page if user is not logged in.', function(done){
            var req, res;
            login.handle(req={
                method:'get', url:'/', session:{loggedIn:false}
            }, res={
                render:function(page){
                    page.should.equal('login');
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should show the login page if there is no session.', function(done){
            var req, res;
            login.handle(req={
                method:'get', url:'/'
            }, res={
                render:function(page){
                    page.should.equal('login');
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should redirect to /home if user is logged in.', function(done){
            var req, res;
            login.handle(req={
                method:'get', url:'/', session:{loggedIn:true}
            }, res={
                redirect:function(url){
                    url.should.equal('/home');
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
    });
    describe('get /login', function(){
        it('Should show the login page if user is not logged in.', function(done){
            var req, res;
            login.handle(req={
                method:'get', url:'/login', session:{loggedIn:false}
            }, res={
                render:function(page){
                    page.should.equal('login');
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should show the login page if there is no session.', function(done){
            var req, res;
            login.handle(req={
                method:'get', url:'/login'
            }, res={
                render:function(page){
                    page.should.equal('login');
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should redirect to /home if user is logged in.', function(done){
            var req, res;
            login.handle(req={
                method:'get', url:'/login', session:{loggedIn:true}
            }, res={
                redirect:function(url){
                    url.should.equal('/home');
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
    });
    describe('post /login', function(){
        it('Should log the user in if a valid user/password is given.', function(done){
            var req, res;
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(null, [{tries:0}], {}); },
                findByUsername: function(username, callback){ callback(null, [{
                    user_id:9393,login:'pepe', password: mock.sha256('password magico')
                }], {})},
                update: sinon.spy(function(obj, cb){ setImmediate(cb);})
            };
            login.handle(req={
                method:'POST', url:'/login', body:{
                    username: 'pepe', password:'password magico', captcha:'captcha'
                }, query:{}, session:{}
            }, res={
                json:function(obj){
                    req.session.loggedIn.should.be.true;
                    should.exist(req.session.user);
                    mock.model.users.update.calledOnce.should.be.true;
                    mock.model.users.update.args[0][0].should.contain.keys(['user_id', 'last_login', 'login_tries']);
                    mock.model.users.update.args[0][0].user_id.should.equal(9393);
                    mock.model.users.update.args[0][0].login_tries.should.equal(0);
                    obj.should.deep.equal({success:true, redirect:'/home'});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should fail login attempt if password is wrong.', function(done){
            var req, res;
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(null, [{tries:0}], {}); },
                findByUsername: function(username, callback){ callback(null, [{
                    user_id:9393,login:'pepe', password: mock.sha256('password magico'), login_tries:0
                }], {})},
                loginTry: sinon.spy(function(obj, cb){ setImmediate(cb);}),
                update: sinon.spy(function(obj, cb){ setImmediate(cb);})
            };
            login.handle(req={
                method:'POST', url:'/login', body:{
                    username: 'pepe', password:'password no muy magico', captcha:'captcha'
                }, query:{}, session:{}
            }, res={
                json:function(obj){
                    should.not.exist(req.session.loggedIn);
                    should.not.exist(req.session.user);
                    mock.model.users.update.calledOnce.should.be.true;
                    mock.model.users.update.args[0][0].should.contain.keys(['user_id', 'login_tries']);
                    mock.model.users.update.args[0][0].should.not.contain.keys(['last_login']);
                    mock.model.users.update.args[0][0].user_id.should.equal(9393);
                    mock.model.users.update.args[0][0].login_tries.should.equal(1);
                    mock.model.users.loginTry.calledOnce.should.be.true;
                    mock.model.users.loginTry.args[0][2].should.equal('invalid_password');
                    obj.should.deep.equal({captchaNeeded:false, error:'Invalid username or password'});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should fail login attempt if user does not exists.', function(done){
            var req, res;
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(null, [{tries:0}], {}); },
                findByUsername: function(username, callback){ callback(null, [], {})},
                loginTry: sinon.spy(function(obj, cb){ setImmediate(cb);}),
                update: sinon.spy(function(obj, cb){ setImmediate(cb);})
            };
            login.handle(req={
                method:'POST', url:'/login', body:{
                    username: 'pedro', password:'password magico', captcha:'captcha'
                }, query:{}, session:{}
            }, res={
                json:function(obj){
                    should.not.exist(req.session.loggedIn);
                    should.not.exist(req.session.user);
                    mock.model.users.loginTry.calledOnce.should.be.true;
                    mock.model.users.loginTry.args[0][2].should.equal('invalid_username');
                    obj.should.deep.equal({captchaNeeded:false, error:'Invalid username or password'});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should call console.error if user post-login update fails.', function(done){
            var req, res;
            sinon.stub(console, 'error', function(err){
                console.error.restore();
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            })
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(null, [{tries:0}], {}); },
                findByUsername: function(username, callback){ callback(null, [{
                    user_id:9393,login:'pepe', password: mock.sha256('password magico')
                }], {})},
                update: sinon.spy(function(obj, cb){ setImmediate(cb, new Error('I am error'));})
            };
            login.handle(req={
                method:'POST', url:'/login', body:{
                    username: 'pepe', password:'password magico', captcha:'captcha'
                }, query:{}, session:{}
            }, res={
                json:function(){}
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should fail if user fetch or login count fetch fails.', function(done){
            var req, res;
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(new Error('I am error')); },
                findByUsername: function(username, callback){ callback(null, [{
                    user_id:9393,login:'pepe', password: mock.sha256('password magico')
                }], {})},
                update: sinon.spy(function(obj, cb){ setImmediate(cb);})
            };
            login.handle(req={
                method:'POST', url:'/login', body:{
                    username: 'pepe', password:'password magico', captcha:'captcha'
                }, query:{}, session:{}
            }, res={
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
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
