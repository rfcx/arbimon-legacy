/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var async = require('async');
var sinon = require('sinon');
var rewire = require('rewire');
var pokeDaMonkey = rewire('../../../app/utils/monkey');
var mock_ec2 = new (require('../../mock_tools/mock_ec2'))();

var mock_config = {
    hosts: {
        jobqueue : 'http://jobqueue.com'
    },
    'job-queue' : {
        instanceId : 'job-queue-instance-id'
    }
};
var real_poke = pokeDaMonkey.__get__('poke');
var real_spank = pokeDaMonkey.__get__('spank');
var mocks = {
    ec2 : mock_ec2,
    request : { post:function(){
        if(mocks.request.post.__spy__){
            mocks.request.post.__spy__.apply(null, Array.prototype.slice.apply(arguments));
        }
        setImmediate(arguments[arguments.length-1]);
    } },
    spank : function(){
        var args = Array.prototype.slice.apply(arguments);
        if(mocks.spank.__spy__){
            mocks.spank.__spy__.apply(this, args);
        }
        real_spank.apply(this, args);
    },
    poke : function(){
        var args = Array.prototype.slice.apply(arguments);
        if(mocks.poke.__spy__){
            mocks.poke.__spy__.apply(this, args);
        }
        real_poke.apply(this, args);
    },
    config : function (key){
        return mock_config[key];
    }
};


pokeDaMonkey.__set__(mocks);


describe('monkey', function(){
    var real_ENV = process.env.NODE_ENV;
    describe('Not in production server', function(){
        beforeEach(function(){
            process.env.NODE_ENV = "meh...";
        });
        afterEach(function(){
            process.env.NODE_ENV = real_ENV;
            delete mocks.request.post.__spy__;
        });
        it('It not in production server, then should just poke the monkey', function(done){
            mocks.request.post.__spy__ = function(url){
                should.exist(url);
                url.should.equal(mock_config.hosts.jobqueue + '/notify');
                done();
            };
            pokeDaMonkey();
        });
        
    });
    describe('In production server', function(){
        beforeEach(function(){
            process.env.NODE_ENV = "production";
            if(mock_ec2.instance_cache[mock_config['job-queue'].instanceId]){
                delete mock_ec2.instance_cache[mock_config['job-queue'].instanceId];
            }
            sinon.stub(console, 'error', function(){
                if(console.error.__spy__){
                    console.error.__spy__.apply(null, Array.prototype.slice.apply(arguments));
                }
            });
        });
        afterEach(function(){
            process.env.NODE_ENV = real_ENV;
            delete mocks.request.post.__spy__;
            delete mocks.poke.__spy__;
            delete mocks.spank.__spy__;
            delete mock_ec2.__listeners;
            console.error.restore();
        });
        it('If describeInstances crashes then write error to console', function(done){
            mocks.poke.__spy__  = function(url){done(new Error("Monkey was poked."));};
            mocks.spank.__spy__ = function(url){done(new Error("Monkey was spanked."));};
            console.error.__spy__ = function(){
                done();
            };
            pokeDaMonkey();
        });
        it('If describeInstances \'running\', then poke the monkey', function(done){
            mock_ec2.__setInstance(mock_config['job-queue'].instanceId, 'running');
            console.error.__spy__ = function(){done(new Error("Console error called, monkey wasn't poked."));};
            mocks.poke.__spy__ = sinon.spy();
            mocks.spank.__spy__ = function(url){done(new Error("Monkey was spanked."));};
            mocks.request.post.__spy__ = function(url){
                should.exist(url);
                mocks.poke.__spy__.calledOnce.should.be.true;
                url.should.equal(mock_config.hosts.jobqueue + '/notify');
                done();
            };
            pokeDaMonkey();
        });
        it('If describeInstances \'stopped\', then spank the monkey', function(done){
            mock_ec2.__setInstance(mock_config['job-queue'].instanceId, 'stopped');
            console.error.__spy__ = function(){done(new Error("Console error called, monkey wasn't poked."));};
            mocks.poke.__spy__ = function(url){done(new Error("Monkey was poked."));};
            mocks.spank.__spy__ = sinon.spy();
            mock_ec2.waitFor('instanceRunning', function(){
                mocks.spank.__spy__.calledOnce.should.be.true;
                done();
            });
            pokeDaMonkey();
        });
        it('If describeInstances \'stopping\', then wait for it to stop and when it stopped, spank the monkey', function(done){
            mock_ec2.__setInstance(mock_config['job-queue'].instanceId, 'stopping');
            console.error.__spy__ = function(){done(new Error("Console error called, monkey wasn't poked."));};
            mocks.poke.__spy__ = function(url){done(new Error("Monkey was poked."));};
            mocks.spank.__spy__ = sinon.spy();
            mock_ec2.waitFor('instanceRunning', function(){
                mocks.spank.__spy__.calledOnce.should.be.true;
                done();
            });
            pokeDaMonkey();
            mock_ec2.__setInstance(mock_config['job-queue'].instanceId, 'stopped');
        });
        it('If describeInstances \'stopping\', then wait for it to stop and if error, then write it to error console', function(done){
            mock_ec2.__setInstance(mock_config['job-queue'].instanceId, 'stopping', {'!cannot_be_stopped':true});
            console.error.__spy__ = function(){
                done();
            };
            mocks.poke.__spy__ = function(url){done(new Error("Monkey was poked."));};
            mocks.spank.__spy__ = function(url){done(new Error("Monkey was spanked."));};
            pokeDaMonkey();
            mock_ec2.__setInstance(mock_config['job-queue'].instanceId, 'stopped');
        });
        it('If describeInstances \'pending\', then do nothing', function(done){
            mock_ec2.__setInstance(mock_config['job-queue'].instanceId, 'pending');
            console.error.__spy__ = function(){done(new Error("Console error called, monkey wasn't poked."));};
            mocks.poke.__spy__ = function(url){done(new Error("Monkey was poked."));};
            mocks.spank.__spy__ = function(url){done(new Error("Monkey was spanked."));};
            pokeDaMonkey();
            setImmediate(done);
        });
        it('If describeInstances \'shutting-down\', then do nothing', function(done){
            mock_ec2.__setInstance(mock_config['job-queue'].instanceId, 'shutting-down');
            console.error.__spy__ = function(){done(new Error("Console error called, monkey wasn't poked."));};
            mocks.poke.__spy__ = function(url){done(new Error("Monkey was poked."));};
            mocks.spank.__spy__ = function(url){done(new Error("Monkey was spanked."));};
            pokeDaMonkey();
            setImmediate(done);
        });
        it('If describeInstances \'terminated\', then do nothing', function(done){
            mock_ec2.__setInstance(mock_config['job-queue'].instanceId, 'terminated');
            console.error.__spy__ = function(){done(new Error("Console error called, monkey wasn't poked."));};
            mocks.poke.__spy__ = function(url){done(new Error("Monkey was poked."));};
            mocks.spank.__spy__ = function(url){done(new Error("Monkey was spanked."));};
            pokeDaMonkey();
            setImmediate(done);
        });
        it('If, after spaking, instance does not start, then write to console.error', function(done){
            mock_ec2.__setInstance(mock_config['job-queue'].instanceId, 'stopped', {'!cannot_start':true});
            console.error.__spy__ = function(){
                mocks.spank.__spy__.calledOnce.should.be.true;
                done();
            };
            mocks.poke.__spy__ = function(url){done(new Error("Monkey was poked."));};
            mocks.spank.__spy__ = sinon.spy();
            pokeDaMonkey();
        });
    });

});
