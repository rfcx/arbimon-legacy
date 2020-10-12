/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var sinon = require('sinon');

var routes = require('../../../app/routes');

describe('index.js', function(){
    describe('GET /classifiers', function(){
        it('Should show the classifiers page.', function(done){
            routes.handle({ method:'get', url:'/classifiers'}, {
                render: function(page, options){
                    page.should.equal('classifiers');
                    done();
                }
            }, function(err){
                done(err || new Error("Request was wrongly handled"));
            });
        });
    });
    describe('GET /support', function(){
        it('Should show the support page.', function(done){
            routes.handle({ method:'get', url:'/support'}, {
                render: function(page, options){
                    page.should.equal('post-page');
                    expect(options).to.exist;
                    options.content.should.equal('support');
                    done();
                }
            }, function(err){
                done(err || new Error("Request was wrongly handled"));
            });
        });
    });
    describe.skip('GET /alive', function(){
        it('Should return a 200 status.', function(done){
            routes.handle({method:'get', url:'/alive'}, {
                sendStatus: function(status){
                    status.should.equal(200);
                    done();
                }
            }, function(err){
                done(err || new Error("Request was wrongly handled"));
            });
        });
    });

    describe('login access middleware', function(){
        it('Should restrict access if not logged in.', function(done){
            routes.handle({method:'get', url:'/some-exotic-url-link'}, {
                render: function(page){
                    page.should.equal('get_fragment_hack.ejs');
                    done();
                }
            }, function(err){
                done(err || new Error("Request was wrongly handled"));
            });
        });
        it('Should allow access if logged in.', function(done){
            routes.handle({method:'get', url:'/some-exotic-url-link', session:{loggedIn:true}}, {
            }, function(err){
                if(err){
                    done(err);
                } else {
                    done(); // since the url doesnt exist, then request just went straight to the callback
                }
            });
        });
    });

    describe('GET /', function(){
        it('Should show the support page.', function(done){
            routes.handle({method:'get', url:'/', session:{loggedIn:true}}, {
                redirect: function(url){
                    url.should.equal('/home');
                    done();
                }
            }, function(err){
                done(err || new Error("Request was wrongly handled"));
            });
        });
    });
    
    describe('GET /home', function(){
        it('Should show the home page to logged in users.', function(done){
            routes.handle({method:'get', url:'/home', session:{loggedIn:true}}, {
                render: function(page){
                    page.should.equal('home');
                    done();
                }
            }, function(err){
                done(err || new Error("Request was wrongly handled"));
            });
        });
        it('Should restrict access if not logged in.', function(done){
            routes.handle({method:'get', url:'/home'}, {
                render: function(page){
                    page.should.equal('get_fragment_hack.ejs');
                    done();
                }
            }, function(err){
                done(err || new Error("Request was wrongly handled"));
            });
        });
    });
    describe('GET /user-settings', function(){
        it('Should show the user settings page to logged in users.', function(done){
            routes.handle({method:'get', url:'/user-settings', session:{loggedIn:true, user:{}}}, {
                render: function(page){
                    page.should.equal('user-settings');
                    done();
                }
            }, function(err){
                done(err || new Error("Request was wrongly handled"));
            });
        });
        it('Should redirect to home if not logged in.', function(done){
            routes.handle({method:'get', url:'/user-settings', session:{}}, {
                redirect: function(url){
                    url.should.equal('/home');
                    done();
                }
            }, function(err){
                done(err || new Error("Request was wrongly handled"));
            });
        });
    });
});
