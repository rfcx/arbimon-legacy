/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var sinon = require('sinon');
var rewire= require('rewire');
var events = require('events');
var router_expect = require('../../mock_tools/router_expect');
var dd = console.log;

var admin = rewire('../../../app/routes/admin');

var mock_config={
    hosts:{jobqueue:'host://jobqueue/'}
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
    request: delegated_async_function('request'),
    model:{
        jobs:{}
    }
};
admin.__set__(mock);

var admin_router = router_expect(admin, {
    session:{user:{id:9393, isSuper:1}}
});

// TODO write unit test for new routes
describe('admin.js', function(){
    afterEach(function(){
        mock.model.jobs={};
        delete mock.request.delegate;
        delete mock.request.get;
    });
    
    describe('use access restriction middleware', function(){
        it('Should allow superusers in.', function(done){
            admin_router.when('/some_page', { next: function(req, res, err){
                should.not.exist(err);
                done();
            }});
        });

        it('Should respond 403 to non-superusers.', function(done){
            admin_router.when({url:'/some_page', session:{user:{isSuper:0}}}, { next:true, status: function(req, res, status){
                status.should.equal(404);
                done();
            }});
        });
    });
    
    describe('GET /', function() {
        it('Should render the admins page.', function(done){
            admin_router.when('/', { render: function(req, res, page){
                page.should.equal("admin");
                done();
            }});
        });
    });
    
    describe('GET /job-queue', function() {
        it('Should respond json with the jobqueue server\'s status.', function(done){
            mock.request.get = function(url){
                var emiter = new events.EventEmitter();
                emiter.pipe = function(obj){
                    this.on('data', obj.write.bind(obj));
                };
                setImmediate(function(){
                    emiter.emit('data', "!!!job-queue-data!!!");
                });
                return emiter;
            };
            admin_router.when('/job-queue', { write: function(req, res, data){
                data.should.equal("!!!job-queue-data!!!");
                done();
            }});
        });
        
        it('Should respond error message if jobqueue server\'s status cannot be obtained.', function(done){
            mock.request.get = function(url){
                var emiter = new events.EventEmitter();
                emiter.pipe = function(obj){
                    this.on('data', obj.write.bind(obj));
                };
                setImmediate(function(){
                    emiter.emit('error', "!!!job-queue-data!!!");
                });
                return emiter;
            };
            admin_router.when('/job-queue', { json: function(req, res, obj){
                obj.should.deep.equal({error:'Could not read job queue stats.'});
                done();
            }});
        });
    });

});
