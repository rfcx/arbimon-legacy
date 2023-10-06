/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var sinon = require('sinon');
var q = require('q');
var rewire= require('rewire');
var dd = console.log;

var login = rewire('../../../app/routes/login');

var mock_config={
    'facebook-api':{public:'public facebook api id'},
    'google-api':{oauthId:'google oauth id'},
    mailchimp:{listId:1},
    recaptcha:{secret:"recaptcha secret"}
};
var delegated_async_function = function(name){
    var fn = function(){
        var args = Array.prototype.slice.call(arguments);
        if(fn.delegate){
            fn.delegate.apply(this, args);
        } else {
            setImmediate(args[args.length-1], new Error("cannot delegate " + name));
        }
    };
    return fn;
};
var mock = {
    config: function(arg){return mock_config[arg];},
    sha256: function(x){return '!'+x+'!';},
    transport: {
        sendMail: delegated_async_function('transport.sendMail')
    },
    mc: {lists:{
        subscribe: delegated_async_function('mc.lists')
    }},
    request: delegated_async_function('request'),
    model:{
        users:{}
    }
};
login.__set__(mock);

describe('login.js', function(){
    afterEach(function(){
        mock.model.users={};
        delete mock.transport.sendMail.delegate;
        delete mock.mc.lists.subscribe.delegate;
        delete mock.request.delegate;
        if(console.error.restore){
            console.error.restore();
        }
    });
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
            login.handle(req={method:'get', url:'/some-exotic-url-link', session:{loggedIn:true, user:{
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
            }, loggedIn:true}}, res={}, function(err){
                should.exist(req.haveAccess);
                req.haveAccess(1, 'do the hooky pooky').should.equal(false);
                req.haveAccess(1, 'jump around').should.equal(false);
                done();
            });
        });
        it('Should allow any access on any project to a super user.', function(done){
            var req, res;
            login.handle(req={method:'get', url:'/some-exotic-url-link', session:{user:{isSuper:1}, loggedIn:true}}, res={}, function(err){
                should.exist(req.haveAccess);
                req.haveAccess(1, 'do anything even non-exitent things').should.equal(true);
                done();
            });
        });
    });
    describe('get /legacy-api/login_available', function(){
        it('Should indicate wether a given login is available or not.', function(done){
            mock.model.users.usernameInUse=function(name, cb){
                cb(null, false);
            };
            var req, res;
            login.handle(req={
                method:'get', url:'/legacy-api/login_available', query:{username:'pepe'}
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
                method:'get', url:'/legacy-api/login_available', query:{}
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
                method:'get', url:'/legacy-api/login_available', query:{username:'pepe'}
            }, res={
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
    });
    describe('get /legacy-api/email_available', function(){
        it('Should indicate wether a given email is available or not.', function(done){
            mock.model.users.emailInUse=function(name, cb){
                cb(null, false);
            };
            var req, res;
            login.handle(req={
                method:'get', url:'/legacy-api/email_available', query:{email:'pepe@site.com'}
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
                method:'get', url:'/legacy-api/email_available', query:{email:'invalidemail!#$'}
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
                method:'get', url:'/legacy-api/email_available', query:{}
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
                method:'get', url:'/legacy-api/email_available', query:{email:'pepe@site.com'}
            }, res={
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
    });
    describe('get /', function(){
        it('Should show the landing page if user is not logged in.', function(done){
            var req, res;
            login.handle(req={
                method:'get', url:'/', session:{loggedIn:false}
            }, res={
                render:function(page){
                    page.should.equal('landing-page');
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should show the landing page if there is no session.', function(done){
            var req, res;
            login.handle(req={
                method:'get', url:'/'
            }, res={
                render:function(page){
                    page.should.equal('landing-page');
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
        it('Should delegate call to user.performLogin.', function(done){
            var req, res;
            mock.model.users={
                performLogin: sinon.spy(function(req, auth, options){ 
                    return q.resolve({
                        success: true,
                        redirect : '/home',
                        captchaNeeded: true
                    });
                })
            };
            login.handle(req={
                method:'POST', url:'/login', body:{
                    username: 'pepe', password:'password magico', captcha:'captcha'
                }, query:{}, session:{}
            }, res={
                json:function(obj){
                    mock.model.users.performLogin.calledOnce.should.be.true;
                    mock.model.users.performLogin.args[0][1].should.deep.equal({
                        username : 'pepe',
                        password : 'password magico',
                        captcha  : 'captcha',
                    });
                    mock.model.users.performLogin.args[0][2].should.deep.equal({
                        redirect : undefined
                    });
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it.skip('Should log the user in if a valid user/password is given.', function(done){
            var req, res;
            mock.model.users={
                performLogin: sinon.spy(function(req, auth, options){ 
                    return q.resolve({
                        success: true,
                        redirect : '/home',
                        captchaNeeded: true
                    });
                })
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
        it.skip('Should fail login attempt if password is wrong.', function(done){
            var req, res;
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(null, [{tries:0}], {}); },
                findByUsername: function(username, callback){ callback(null, [{
                    user_id:9393,login:'pepe', password: mock.sha256('password magico'), login_tries:0
                }], {});},
                loginTry: sinon.spy(function(ip, username, reason, cb){ setImmediate(cb);}),
                update: sinon.spy(function(obj, cb){ setImmediate(cb);})
            };
            login.handle(req={
                method:'POST', url:'/login', body:{
                    username: 'pepe', captcha:'captcha'
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
        it.skip('Should fail login attempt if user does not exists.', function(done){
            var req, res;
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(null, [{tries:0}], {}); },
                findByUsername: function(username, callback){ callback(null, []);},
                loginTry: sinon.spy(function(ip, username, reason, cb){ setImmediate(cb);}),
                update: sinon.spy(function(obj, cb){ setImmediate(cb);})
            };
            login.handle(req={
                method:'POST', url:'/login', body:{
                    password:'password magico', captcha:'captcha'
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
        it.skip('Should require a captcha after 3 failed attempts.', function(done){
            var req, res;
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(null, [{tries:2}], {}); },
                findByUsername: function(username, callback){ callback(null, [], {});},
                loginTry: sinon.spy(function(ip, username, reason, cb){ setImmediate(cb);}),
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
                    obj.should.deep.equal({captchaNeeded:true, error:'Invalid username or password'});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it.skip('Should log the user in if a valid user/password is given and captcha is correct.', function(done){
            var req, res;
            mock.request.delegate = sinon.spy(function(url, callback){
                setImmediate(callback, null, 200, JSON.stringify({success:url.qs.response == 'captcha'}));
            });
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(null, [{tries:3}], {}); },
                findByUsername: function(username, callback){ callback(null, [{
                    user_id:9393,login:'pepe', password: mock.sha256('password magico'), login_tries:0
                }], {});},
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
        it.skip('Should fail login attempt if captcha is wrong.', function(done){
            var req, res;
            mock.request.delegate = sinon.spy(function(url, callback){
                setImmediate(callback, null, 200, JSON.stringify({success:url.qs.response == 'captcha'}));
            });
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(null, [{tries:3}], {}); },
                findByUsername: function(username, callback){ callback(null, [{
                    user_id:9393,login:'pepe', password: mock.sha256('password magico'), login_tries:0
                }], {});},
                loginTry: sinon.spy(function(ip, username, reason, cb){ setImmediate(cb);}),
                update: sinon.spy(function(obj, cb){ setImmediate(cb);})
            };
            login.handle(req={
                method:'POST', url:'/login', body:{
                    username: 'pepe', password:'password magico', captcha:'not the captcha'
                }, query:{}, session:{}
            }, res={
                json:function(obj){
                    should.not.exist(req.session.loggedIn);
                    should.not.exist(req.session.user);
                    mock.model.users.loginTry.calledOnce.should.be.true;
                    mock.model.users.loginTry.args[0][2].should.equal('invalid_captcha');
                    obj.should.deep.equal({captchaNeeded:true, error:'Error validating captcha'});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it.skip('Should fail if captcha validation fails.', function(done){
            var req, res;
            mock.request.delegate = sinon.spy(function(url, callback){
                setImmediate(callback, new Error('I am error'));
            });
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(null, [{tries:3}], {}); },
                findByUsername: function(username, callback){ callback(null, [{
                    user_id:9393,login:'pepe', password: mock.sha256('password magico'), login_tries:0
                }], {});},
                update: sinon.spy(function(obj, cb){ setImmediate(cb);})
            };
            login.handle(req={
                method:'POST', url:'/login', body:{
                    username: 'pepe', password:'password magico', captcha:'captcha'
                }, query:{}, session:{}
            }, res={
                json:function(obj){
                }
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });          
        
        it.skip('Should disable the user after 10 failed attempts.', function(done){
            var req, res;
            mock.request.delegate = sinon.spy(function(url, callback){
                setImmediate(callback, null, 200, JSON.stringify({success:url.qs.response == 'captcha'}));
            });
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(null, [{tries:0}], {}); },
                findByUsername: function(username, callback){ callback(null, [{
                    user_id:9393,login:'pepe', password: mock.sha256('password magico'), login_tries:9
                }], {});},
                loginTry: sinon.spy(function(ip, username, reason, cb){ setImmediate(cb);}),
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
                    mock.model.users.update.args[0][0].should.contain.keys(['user_id', 'login_tries', 'disabled_until']);
                    mock.model.users.update.args[0][0].should.not.contain.keys(['last_login']);
                    mock.model.users.update.args[0][0].user_id.should.equal(9393);
                    mock.model.users.update.args[0][0].login_tries.should.equal(0);
                    mock.model.users.loginTry.calledOnce.should.be.true;
                    mock.model.users.loginTry.args[0][2].should.equal('invalid_password');
                    obj.should.deep.equal({captchaNeeded:true, error:'Invalid username or password'});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it.skip('Should fail login after 10 failed attempts.', function(done){
            var req, res;
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(null, [{tries:10}], {}); },
                findByUsername: function(username, callback){ callback(null, [], {});}
            };
            login.handle(req={
                method:'POST', url:'/login', body:{
                    username: 'pepe', password:'password magico', captcha:'captcha'
                }, query:{}, session:{}
            }, res={
                json:function(obj){
                    should.not.exist(req.session.loggedIn);
                    should.not.exist(req.session.user);
                    obj.should.deep.equal({error: "Too many tries, try again in 1 hour. If you think this is wrong contact us."});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it.skip('Should fail login attempt if user is (permanently) disabled.', function(done){
            var req, res;
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(null, [{tries:0}], {}); },
                findByUsername: function(username, callback){ callback(null, [{
                    user_id:9393,login:'pepe', password: mock.sha256('password magico'), disabled_until:'0000-00-00 00:00:00'
                }], {});}
            };
            login.handle(req={
                method:'POST', url:'/login', body:{
                    username: 'pepe', password:'password magico', captcha:'captcha'
                }, query:{}, session:{}
            }, res={
                json:function(obj){
                    should.not.exist(req.session.loggedIn);
                    should.not.exist(req.session.user);
                    obj.should.deep.equal({error: "This account had been disabled"});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
    
        it.skip('Should call console.error if login attempt fails and user update fails.', function(done){
            var req, res;
            sinon.stub(console, 'error', function(err){
                console.error.restore();
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(null, [{tries:0}], {}); },
                findByUsername: function(username, callback){ callback(null, [
                    {user_id:9393,login:'pepe', password: mock.sha256('password magico'), login_tries:0}
                ], {});},
                loginTry: sinon.spy(function(ip, username, reason, cb){ setImmediate(cb);}),
                update: sinon.spy(function(obj, cb){ setImmediate(cb, new Error('I am error'));})
            };
            login.handle(req={
                method:'POST', url:'/login', body:{
                    username: 'pedro', password:'password no muy magico', captcha:'captcha'
                }, query:{}, session:{}
            }, res={
                json:function(obj){
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it.skip('Should call console.error if login attempt fails and login tries update fails.', function(done){
            var req, res;
            sinon.stub(console, 'error', function(err){
                console.error.restore();
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(null, [{tries:0}], {}); },
                findByUsername: function(username, callback){ callback(null, [], {});},
                loginTry: sinon.spy(function(ip, username, reason, cb){ setImmediate(cb, new Error('I am error'));}),
                update: sinon.spy(function(obj, cb){ setImmediate(cb);})
            };
            login.handle(req={
                method:'POST', url:'/login', body:{
                    username: 'pedro', password:'password magico', captcha:'captcha'
                }, query:{}, session:{}
            }, res={
                json:function(obj){}
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it.skip('Should call console.error if user post-login update fails.', function(done){
            var req, res;
            sinon.stub(console, 'error', function(err){
                console.error.restore();
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(null, [{tries:0}], {}); },
                findByUsername: function(username, callback){ callback(null, [{
                    user_id:9393,login:'pepe', password: mock.sha256('password magico')
                }], {});},
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
        it.skip('Should fail if user fetch or login count fetch fails.', function(done){
            var req, res;
            mock.model.users={
                invalidLogins: function(ip, callback){ callback(new Error('I am error')); },
                findByUsername: function(username, callback){ callback(null, [{
                    user_id:9393,login:'pepe', password: mock.sha256('password magico')
                }], {});},
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
        it('Should destroy the current session.', function(done){
            var req, res;
            login.handle(req={
                method:'get', url:'/logout', session:{loggedIn:false, 
                    destroy: sinon.spy(function(cb){setImmediate(cb);})
                }
            }, res={
                redirect:function(url){
                    url.should.equal('/');
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should fail if session destroy fails.', function(done){
            var req, res;
            login.handle(req={
                method:'get', url:'/logout', session:{loggedIn:false, 
                    destroy: sinon.spy(function(cb){setImmediate(cb, new Error('I am error'));})
                }
            }, res={
                redirect:function(url){
                    url.should.equal('/login');
                    done();
                }
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
    });
    describe('get /register', function(){
        it('Should show the registration page', function(done){
            var req, res;
            login.handle(req={method:'get', url:'/register'}, res={
                render:function(page){
                    page.should.equal('register');
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
    });
    describe('get /activate/:hash', function(){
        it('Should activate an account associated to a given account activation hash', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: sinon.spy(function(hash, cb){ setImmediate(cb, null, [{support_request_id:1, expires:new Date().getTime() + 100000, params:JSON.stringify({
                    login:'newguy', otherdata:'yay'
                })}]);}),
                insert: sinon.spy(function(params, cb){ setImmediate(cb, null, {insertId:1}); }),
                removeRequest: sinon.spy(function(reqid, cb){ setImmediate(cb, null, {done:1}); })
            };
            login.handle(req={method:'get', url:'/activate/this-is-the-hash'}, res={
                render:function(page, params){
                    page.should.equal('activate');
                    should.exist(params);
                    params.login.should.be.true;
                    mock.model.users.findAccountSupportReq.calledOnce.should.be.true;
                    mock.model.users.findAccountSupportReq.args[0][0].should.equal('this-is-the-hash');
                    mock.model.users.insert.calledOnce.should.be.true;
                    mock.model.users.removeRequest.calledOnce.should.be.true;
                    mock.model.users.removeRequest.args[0][0].should.equal(1);
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should fail if remove request fails', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: sinon.spy(function(hash, cb){ setImmediate(cb, null, [{support_request_id:1, expires:new Date().getTime() + 100000, params:JSON.stringify({
                    login:'newguy', otherdata:'yay'
                })}]);}),
                insert: sinon.spy(function(params, cb){ setImmediate(cb, null, {insertId:1}); }),
                removeRequest: sinon.spy(function(reqid, cb){ setImmediate(cb, new Error('I am error')); })
            };
            login.handle(req={method:'get', url:'/activate/this-is-the-hash'}, res={
                render:function(page, params){
                    should.not.exist(arguments);
                }
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
        it('Should fail if user insertion fails', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: sinon.spy(function(hash, cb){ setImmediate(cb, null, [{support_request_id:1, expires:new Date().getTime() + 100000, params:JSON.stringify({
                    login:'newguy', otherdata:'yay'
                })}]);}),
                insert: sinon.spy(function(params, cb){ setImmediate(cb, new Error('I am error')); }),
                removeRequest: sinon.spy(function(reqid, cb){ setImmediate(cb, null, {done:1}); })
            };
            login.handle(req={method:'get', url:'/activate/this-is-the-hash'}, res={
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
        it('Should fail activatation if token is expired', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: sinon.spy(function(hash, cb){ setImmediate(cb, null, [{support_request_id:1, expires:new Date().getTime() - 100000, params:JSON.stringify({
                    login:'newguy', otherdata:'yay'
                })}]);}),
                insert: sinon.spy(function(params, cb){ setImmediate(cb, null, {insertId:1}); }),
                removeRequest: sinon.spy(function(reqid, cb){ setImmediate(cb, null, {done:1}); })
            };
            login.handle(req={method:'get', url:'/activate/this-is-the-hash'}, res={
                render:function(page, params){
                    page.should.equal('activate');
                    should.exist(params);
                    params.login.should.be.false;
                    mock.model.users.findAccountSupportReq.calledOnce.should.be.true;
                    mock.model.users.findAccountSupportReq.args[0][0].should.equal('this-is-the-hash');
                    mock.model.users.removeRequest.calledOnce.should.be.true;
                    mock.model.users.removeRequest.args[0][0].should.equal(1);
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should fail if fetching the request fails', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: sinon.spy(function(hash, cb){ setImmediate(cb, new Error('I am error'));}),
                insert: sinon.spy(function(params, cb){ setImmediate(cb, null, {insertId:1}); }),
                removeRequest: sinon.spy(function(reqid, cb){ setImmediate(cb, null, {done:1}); })
            };
            login.handle(req={method:'get', url:'/activate/this-is-the-hash'}, res={
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
        it('Should fail activation if hash doesnt exist', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: sinon.spy(function(hash, cb){ setImmediate(cb, null, []);}),
                insert: sinon.spy(function(params, cb){ setImmediate(cb, null, {insertId:1}); }),
                removeRequest: sinon.spy(function(reqid, cb){ setImmediate(cb, null, {done:1}); })
            };
            login.handle(req={method:'get', url:'/activate/this-is-the-hash'}, res={
                render:function(page, params){
                    page.should.equal('activate');
                    should.exist(params);
                    params.login.should.be.false;
                    mock.model.users.findAccountSupportReq.calledOnce.should.be.true;
                    mock.model.users.findAccountSupportReq.args[0][0].should.equal('this-is-the-hash');
                    mock.model.users.insert.calledOnce.should.be.false;
                    mock.model.users.removeRequest.calledOnce.should.be.false;
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should fail if token is expired and remove request fails', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: sinon.spy(function(hash, cb){ setImmediate(cb, null, [{support_request_id:1, expires:new Date().getTime() - 100000, params:JSON.stringify({
                    login:'newguy', otherdata:'yay'
                })}]);}),
                insert: sinon.spy(function(params, cb){ setImmediate(cb, null, {insertId:1}); }),
                removeRequest: sinon.spy(function(reqid, cb){ setImmediate(cb, new Error('I am error')); })
            };
            login.handle(req={method:'get', url:'/activate/this-is-the-hash'}, res={
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
    });
    describe('post /register', function(){
        it('Should process a new user registration form', function(done){
            var req, res;
            mock.request.delegate = function(url, cb){ setImmediate(cb, null, 200, JSON.stringify({success:true}));};
            mock.model.users={
                usernameInUse: function(username, cb){ setImmediate(cb, null, false);},
                emailInUse: function(email, cb){ setImmediate(cb, null, false);},
                newAccountRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});}
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, null, {info:1});};
            login.handle(req={method:'POST', url:'/register', body:{
                user:{firstName: 'Pepe', lastName: 'User', username: 'pepe', email: 'pepe@site.com', password: 'password magico'}, 
                captcha:'captcha', newsletter:false
            }}, res={
                json:function(obj){
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should add the user to the newsletter if he consented', function(done){
            var req, res;
            mock.request.delegate = function(url, cb){ setImmediate(cb, null, 200, JSON.stringify({success:true}));};
            mock.model.users={
                usernameInUse: function(username, cb){ setImmediate(cb, null, false);},
                emailInUse: function(email, cb){ setImmediate(cb, null, false);},
                newAccountRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});}
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, null, {info:1});};
            mock.mc.lists.subscribe.delegate = function(req, cb, cberr){ 
                cb({info:1});
                done();
            };
            login.handle(req={method:'POST', url:'/register', body:{
                user:{firstName: 'Pepe', lastName: 'User', username: 'pepe', email: 'pepe@site.com', password: 'password magico'}, 
                captcha:'captcha', newsletter:true
            }}, res={
                json:function(obj){}
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should fail if new account request creation failed', function(done){
            var req, res;
            mock.request.delegate = function(url, cb){ setImmediate(cb, null, 200, JSON.stringify({success:true}));};
            mock.model.users={
                usernameInUse: function(username, cb){ setImmediate(cb, null, false);},
                emailInUse: function(email, cb){ setImmediate(cb, null, false);},
                newAccountRequest: function(user, hash, cb){ setImmediate(cb, new Error('I am error'));}
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, null, {info:1});};
            login.handle(req={method:'POST', url:'/register', body:{
                user:{firstName: 'Pepe', lastName: 'User', username: 'pepe', email: 'pepe@site.com', password: 'password magico'}, 
                captcha:'captcha', newsletter:false
            }}, res={
            }, function(err){
                should.exist(err);
                err.message.should.equal("I am error");
                done();
            });
        });
        it('Should respond error message if parameters are missing', function(done){
            var req, res;
            mock.request.delegate = function(url, cb){ setImmediate(cb, null, 200, JSON.stringify({success:true}));};
            mock.model.users={
                usernameInUse: function(username, cb){ setImmediate(cb, null, false);},
                emailInUse: function(email, cb){ setImmediate(cb, null, false);},
                newAccountRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});}
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, null, {info:1});};
            login.handle(req={method:'POST', url:'/register', body:{
            }}, res={
                status: function(s){res._status=s; return res;},
                json:function(obj){
                    should.exist(res._status);
                    res._status.should.equal(400);
                    obj.should.deep.equal({error:"missing parameters"});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should respond error message if user data is not valid', function(done){
            var req, res;
            mock.request.delegate = function(url, cb){ setImmediate(cb, null, 200, JSON.stringify({success:true}));};
            mock.model.users={
                usernameInUse: function(username, cb){ setImmediate(cb, null, false);},
                emailInUse: function(email, cb){ setImmediate(cb, null, false);},
                newAccountRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});}
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, null, {info:1});};
            login.handle(req={method:'POST', url:'/register', body:{
                user:{firstName: 'Pepe', lastName: 'User', username: '$ick ^pepA^$$ 4 lifez*', email: 'pepe@site.com', password: 'password magico'}, 
                captcha:'captcha', newsletter:false
            }}, res={
                status: function(s){res._status=s; return res;},
                json:function(obj){
                    should.exist(res._status);
                    res._status.should.equal(400);
                    obj.should.deep.equal({error:"user info invalid"});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should respond error message if username is in use', function(done){
            var req, res;
            mock.request.delegate = function(url, cb){ setImmediate(cb, null, 200, JSON.stringify({success:true}));};
            mock.model.users={
                usernameInUse: function(username, cb){ setImmediate(cb, null, true);},
                emailInUse: function(email, cb){ setImmediate(cb, null, false);},
                newAccountRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});}
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, null, {info:1});};
            login.handle(req={method:'POST', url:'/register', body:{
                user:{firstName: 'Pepe', lastName: 'User', username: 'pepe', email: 'pepe@site.com', password: 'password magico'}, 
                captcha:'captcha', newsletter:false
            }}, res={
                status: function(s){res._status=s; return res;},
                json:function(obj){
                    res._status.should.equal(400);
                    obj.should.deep.equal({error:"Username in use"});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should respond error message if email is in use', function(done){
            var req, res;
            mock.request.delegate = function(url, cb){ setImmediate(cb, null, 200, JSON.stringify({success:true}));};
            mock.model.users={
                usernameInUse: function(username, cb){ setImmediate(cb, null, false);},
                emailInUse: function(email, cb){ setImmediate(cb, null, true);},
                newAccountRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});}
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, null, {info:1});};
            login.handle(req={method:'POST', url:'/register', body:{
                user:{firstName: 'Pepe', lastName: 'User', username: 'pepe', email: 'pepe@site.com', password: 'password magico'}, 
                captcha:'captcha', newsletter:false
            }}, res={
                status: function(s){res._status=s; return res;},
                json:function(obj){
                    res._status.should.equal(400);
                    obj.should.deep.equal({error:"An account exists with that email"});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should respond error message if captcha is not valid', function(done){
            var req, res;
            mock.request.delegate = function(url, cb){ setImmediate(cb, null, 200, JSON.stringify({success:false}));};
            mock.model.users={
                usernameInUse: function(username, cb){ setImmediate(cb, null, false);},
                emailInUse: function(email, cb){ setImmediate(cb, null, false);},
                newAccountRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});}
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, null, {info:1});};
            login.handle(req={method:'POST', url:'/register', body:{
                user:{firstName: 'Pepe', lastName: 'User', username: 'pepe', email: 'pepe@site.com', password: 'password magico'}, 
                captcha:'captcha', newsletter:false
            }}, res={
                status: function(s){res._status=s; return res;},
                json:function(obj){
                    res._status.should.equal(400);
                    obj.should.deep.equal({error:'Error validating captcha'});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should fail if username in use check failed', function(done){
            var req, res;
            mock.request.delegate = function(url, cb){ setImmediate(cb, null, 200, JSON.stringify({success:true}));};
            mock.model.users={
                usernameInUse: function(username, cb){ setImmediate(cb, new Error("I am error"));},
                emailInUse: function(email, cb){ setImmediate(cb, null, false);},
                newAccountRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});}
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, null, {info:1});};
            login.handle(req={method:'POST', url:'/register', body:{
                user:{firstName: 'Pepe', lastName: 'User', username: 'pepe', email: 'pepe@site.com', password: 'password magico'}, 
                captcha:'captcha', newsletter:false
            }}, res={
            }, function(err){
                should.exist(err);
                err.message.should.equal("I am error");
                done();
            });
        });
        it('Should fail if email in use check failed', function(done){
            var req, res;
            mock.request.delegate = function(url, cb){ setImmediate(cb, null, 200, JSON.stringify({success:true}));};
            mock.model.users={
                usernameInUse: function(username, cb){ setImmediate(cb, null, false);},
                emailInUse: function(email, cb){ setImmediate(cb, new Error("I am error"));},
                newAccountRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});}
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, null, {info:1});};
            login.handle(req={method:'POST', url:'/register', body:{
                user:{firstName: 'Pepe', lastName: 'User', username: 'pepe', email: 'pepe@site.com', password: 'password magico'}, 
                captcha:'captcha', newsletter:false
            }}, res={
            }, function(err){
                should.exist(err);
                err.message.should.equal("I am error");
                done();
            });
        });
        it('Should fail if captcha validation failed', function(done){
            var req, res;
            mock.request.delegate = function(url, cb){ setImmediate(cb, new Error("I am error"));};
            mock.model.users={
                usernameInUse: function(username, cb){ setImmediate(cb, null, false);},
                emailInUse: function(email, cb){ setImmediate(cb, null, false);},
                newAccountRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});}
            };
            sinon.stub(console,'error', function(){});
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, null, {info:1});};
            login.handle(req={method:'POST', url:'/register', body:{
                user:{firstName: 'Pepe', lastName: 'User', username: 'pepe', email: 'pepe@site.com', password: 'password magico'}, 
                captcha:'captcha', newsletter:false
            }}, res={
                sendStatus: function(status){
                    status.should.equal(500);
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should output to console.error if newsletter subscription failed', function(done){
            var req, res;
            mock.request.delegate = function(url, cb){ setImmediate(cb, null, 200, JSON.stringify({success:true}));};
            mock.model.users={
                usernameInUse: function(username, cb){ setImmediate(cb, null, false);},
                emailInUse: function(email, cb){ setImmediate(cb, null, false);},
                newAccountRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});}
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, null, {info:1});};
            mock.mc.lists.subscribe.delegate = function(req, cb, cberr){ 
                cberr(new Error('I am error'));
            };
            sinon.stub(console, 'error', function(err){
                err.should.equal('newsletter subscribe error: ');
                done();
            });
            login.handle(req={method:'POST', url:'/register', body:{
                user:{firstName: 'Pepe', lastName: 'User', username: 'pepe', email: 'pepe@site.com', password: 'password magico'}, 
                captcha:'captcha', newsletter:true
            }}, res={
                json:function(obj){}
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should remove the account request if the sendMail failed', function(done){
            var req, res;
            mock.request.delegate = function(url, cb){ setImmediate(cb, null, 200, JSON.stringify({success:true}));};
            mock.model.users={
                usernameInUse: function(username, cb){ setImmediate(cb, null, false);},
                emailInUse: function(email, cb){ setImmediate(cb, null, false);},
                newAccountRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});},
                removeRequest: sinon.spy(function(rid, cb){ setImmediate(cb); })
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, new Error('I am error'));};
            login.handle(req={method:'POST', url:'/register', body:{
                user:{firstName: 'Pepe', lastName: 'User', username: 'pepe', email: 'pepe@site.com', password: 'password magico'}, 
                captcha:'captcha', newsletter:false
            }}, res={
                status: function(s){res._status=s; return res;},
                json:function(obj){
                    should.exist(res._status);
                    res._status.should.equal(500);
                    obj.should.deep.equal({error: "Could not send confirmation email."});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should fail if removing the account request fails after sendMail failed', function(done){
            var req, res;
            mock.request.delegate = function(url, cb){ setImmediate(cb, null, 200, JSON.stringify({success:true}));};
            mock.model.users={
                usernameInUse: function(username, cb){ setImmediate(cb, null, false);},
                emailInUse: function(email, cb){ setImmediate(cb, null, false);},
                newAccountRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});},
                removeRequest: sinon.spy(function(rid, cb){ setImmediate(cb, new Error('I am error')); })
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, new Error('error'));};
            login.handle(req={method:'POST', url:'/register', body:{
                user:{firstName: 'Pepe', lastName: 'User', username: 'pepe', email: 'pepe@site.com', password: 'password magico'}, 
                captcha:'captcha', newsletter:false
            }}, res={
                status: function(s){res._status=s; return res;},
            }, function(err){
                should.exist(err);
                err.message.should.equal("I am error");
                done();
            });
        });
    });
    describe('get /forgot_request', function(){
        it('Should show the forgot password page', function(done){
            var req, res;
            login.handle(req={method:'get', url:'/forgot_request'}, res={
                render:function(page){
                    page.should.equal('forgot-request');
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
    });
    describe('post /forgot_request', function(){
        it('Should process a new user registration form', function(done){
            var req, res;
            mock.model.users={
                findByEmail: function(email, cb){ setImmediate(cb, null, [{login:'pepe', firstname:'Pepe', lastname:'User'}]);},
                newPasswordResetRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});}
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, null, {info:1});};
            login.handle(req={method:'POST', url:'/forgot_request', body:{
                email:'pepe@site.com'
            }}, res={
                json:function(obj){
                    obj.should.deep.equal({success:true});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should respond error message if email is not valid', function(done){
            var req, res;
            mock.model.users={
                findByEmail: function(email, cb){ setImmediate(cb, null, [{login:'pepe', firstname:'Pepe', lastname:'User'}]);},
                newPasswordResetRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});}
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, null, {info:1});};
            login.handle(req={method:'POST', url:'/forgot_request', body:{
                email:'invalid email'
            }}, res={
                json:function(obj){
                    obj.should.deep.equal({error:'Invalid email address'});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should respond error message if no user is found with that email', function(done){
            var req, res;
            mock.model.users={
                findByEmail: function(email, cb){ setImmediate(cb, null, []);},
                newPasswordResetRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});}
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, null, {info:1});};
            login.handle(req={method:'POST', url:'/forgot_request', body:{
                email:'pepe@site.com'
            }}, res={
                json:function(obj){
                    obj.should.deep.equal({error:'no user register with that email'});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should fail if findByEmail fails', function(done){
            var req, res;
            mock.model.users={
                findByEmail: function(email, cb){ setImmediate(cb, new Error('I am error'));},
                newPasswordResetRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});}
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, null, {info:1});};
            login.handle(req={method:'POST', url:'/forgot_request', body:{
                email:'pepe@site.com'
            }}, res={
                json:function(obj){
                    obj.should.deep.equal({success:true});
                    done();
                }
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
        it('Should fail if sendMail fails', function(done){
            var req, res;
            mock.model.users={
                findByEmail: function(email, cb){ setImmediate(cb, null, [{login:'pepe', firstname:'Pepe', lastname:'User'}]);},
                newPasswordResetRequest: function(user, hash, cb){ setImmediate(cb, null, {insertId:1});}
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, new Error('I am error'));};
            login.handle(req={method:'POST', url:'/forgot_request', body:{
                email:'pepe@site.com'
            }}, res={
                json:function(obj){
                    obj.should.deep.equal({success:true});
                    done();
                }
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
        it('Should fail if password request creation fails', function(done){
            var req, res;
            mock.model.users={
                findByEmail: function(email, cb){ setImmediate(cb, null, [{login:'pepe', firstname:'Pepe', lastname:'User'}]);},
                newPasswordResetRequest: function(user, hash, cb){ setImmediate(cb, new Error('I am error'));}
            };
            mock.transport.sendMail.delegate = function(mail, cb){ setImmediate(cb, null, {info:1});};
            login.handle(req={method:'POST', url:'/forgot_request', body:{
                email:'pepe@site.com'
            }}, res={
                json:function(obj){
                    obj.should.deep.equal({success:true});
                    done();
                }
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
    });
    describe('get /reset_password/:hash', function(){
        it('Should show a password reset page, if hash is valid', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: function(hash, cb){ setImmediate(cb, null, [
                    {expires:new Date().getTime()+10000}
                ]);},
                removeRequest:function(reqid, cb){ setImmediate(cb, null, {done:1});}
            };
            login.handle(req={method:'GET', url:'/reset_password/this-is-a-hash'}, res={
                render:function(page, args){
                    page.should.equal('reset-password');
                    args.should.deep.equal({error:''});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should indicate when a given hash is expired', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: function(hash, cb){ setImmediate(cb, null, [
                    {expires:new Date().getTime()-10000}
                ]);},
                removeRequest:function(reqid, cb){ setImmediate(cb, null, {done:1});}
            };
            login.handle(req={method:'GET', url:'/reset_password/this-is-a-hash'}, res={
                render:function(page, args){
                    page.should.equal('reset-password');
                    args.should.deep.equal({error:'Your reset password link has expired'});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should indicate when a given hash is not valid', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: function(hash, cb){ setImmediate(cb, null, []);},
                removeRequest:function(reqid, cb){ setImmediate(cb, null, {done:1});}
            };
            login.handle(req={method:'GET', url:'/reset_password/this-is-a-hash'}, res={
                render:function(page, args){
                    page.should.equal('reset-password');
                    args.should.deep.equal({error:'Invalid reset password link'});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should fail if findAccountSupportReq fails', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: function(hash, cb){ setImmediate(cb, new Error('I am error'));},
                removeRequest:function(reqid, cb){ setImmediate(cb, null, {done:1});}
            };
            login.handle(req={method:'GET', url:'/reset_password/this-is-a-hash'}, res={
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
        it('Should fail if removeRequest fails', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: function(hash, cb){ setImmediate(cb, null, [
                    {expires:new Date().getTime()-10000}
                ]);},
                removeRequest:function(reqid, cb){ setImmediate(cb, new Error('I am error'));}
            };
            login.handle(req={method:'GET', url:'/reset_password/this-is-a-hash'}, res={
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
    });
    describe('post /reset_password/:hash', function(){
        it('Should reset a password, if hash is valid', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: function(hash, cb){ setImmediate(cb, null, [
                    {expires:new Date().getTime()+10000}
                ]);},
                removeRequest:function(reqid, cb){ setImmediate(cb, null, {done:1});},
                update: sinon.spy(function(obj, cb){ setImmediate(cb, null, {affectedRows:1});})
            };
            login.handle(req={method:'POST', url:'/reset_password/this-is-a-hash', body:{
                password:'nuevo password magico'
            }}, res={
                json:function(obj){
                    obj.should.deep.equal({success:true});
                    done();
                },
                render:function(page, args){
                    arguments.should.deep.equal([]);
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should indicate when a given hash is expired', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: function(hash, cb){ setImmediate(cb, null, [
                    {expires:new Date().getTime()-10000}
                ]);},
                removeRequest:function(reqid, cb){ setImmediate(cb, null, {done:1});}
            };
            login.handle(req={method:'POST', url:'/reset_password/this-is-a-hash'}, res={
                render:function(page, args){
                    page.should.equal('reset-password');
                    args.should.deep.equal({error:'Your reset password link has expired'});
                    done();
                }
            }, function(err){
                done(err || new Error('Request not handled.'));
            });
        });
        it('Should delegate to router when a given hash is not valid', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: function(hash, cb){ setImmediate(cb, null, []);},
                removeRequest:function(reqid, cb){ setImmediate(cb, null, {done:1});}
            };
            login.handle(req={method:'POST', url:'/reset_password/this-is-a-hash'}, res={
                render:function(page, args){
                    page.should.equal('reset-password');
                    args.should.deep.equal({error:'Invalid reset password link'});
                    done();
                }
            }, function(err){
                should.not.exist(err);
                done();
            });
        });
        it('Should fail if findAccountSupportReq fails', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: function(hash, cb){ setImmediate(cb, new Error('I am error'));},
                removeRequest:function(reqid, cb){ setImmediate(cb, null, {done:1});}
            };
            login.handle(req={method:'POST', url:'/reset_password/this-is-a-hash'}, res={
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
        it('Should fail if removeRequest fails', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: function(hash, cb){ setImmediate(cb, null, [
                    {expires:new Date().getTime()-10000}
                ]);},
                removeRequest:function(reqid, cb){ setImmediate(cb, new Error('I am error'));}
            };
            login.handle(req={method:'POST', url:'/reset_password/this-is-a-hash'}, res={
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
        it('Should fail if user update fails', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: function(hash, cb){ setImmediate(cb, null, [
                    {expires:new Date().getTime()+10000}
                ]);},
                removeRequest:function(reqid, cb){ setImmediate(cb, null, {done:1});},
                update: sinon.spy(function(obj, cb){ setImmediate(cb, new Error('I am error'));})
            };
            login.handle(req={method:'POST', url:'/reset_password/this-is-a-hash', body:{
                password:'nuevo password magico'
            }}, res={
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
        it('Should fail if removeRequest update fails after user update', function(done){
            var req, res;
            mock.model.users={
                findAccountSupportReq: function(hash, cb){ setImmediate(cb, null, [
                    {expires:new Date().getTime()+10000}
                ]);},
                removeRequest:function(reqid, cb){ setImmediate(cb, new Error('I am error'));},
                update: sinon.spy(function(obj, cb){ setImmediate(cb, null, {affectedRows:1});})
            };
            login.handle(req={method:'POST', url:'/reset_password/this-is-a-hash', body:{
                password:'nuevo password magico'
            }}, res={
            }, function(err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });

    });        
});
