/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var sinon = require('sinon');
var rewire= require('rewire');
var router_expect = require('../mock_tools/router_expect');

var project = rewire('../../app/routes/project');
var mock = {
    model:{
        projects:{},
        users:{}
    }
};
project.__set__(mock);

var project_router = router_expect(project, {
    session:{user:{id:9393, isSuper:0}}
});

describe('routes/project.js', function(){
    beforeEach(function(){
        mock.model.projects={};
        mock.model.users={
            getPermissions: function(userid, projectid, cb){setImmediate(cb, null, []);}
        };
    });
    describe('get /:projecturl?/', function(){
        it('Should show the app page for the given project.', function(done){
            mock.model.projects.findByUrl = function(url, cb){setImmediate(cb, null, [{project_id:5, name:'project_5', is_private:false, is_enabled:true}]);};
            mock.model.users.getPermissions= function(userid, projectid, cb){setImmediate(cb, null, [{permission:'die'}]);};
            project_router.when('/project_5/', { render: function(req, res, page, args){
                page.should.equal('app');
                should.exist(req.project);
                req.project.should.deep.equal({id: 5, name: 'project_5'});
                args.should.deep.equal({ project: req.project, user: req.session.user });
                done();
            }});
        });
        it('Should call next() if the project is private, the user has no permissions in the project and is not a super user.', function(done){
            mock.model.projects.findByUrl = function(url, cb){setImmediate(cb, null, [{project_id:5, name:'project_5', is_private:true, is_enabled:true}]);};
            project_router.when('/project_5/', { next: function(req, res, err){
                should.not.exist(err);
                done();
            }});
        });
        it('Should show the app page if the project is private and the user has permisssions.', function(done){
            mock.model.projects.findByUrl = function(url, cb){setImmediate(cb, null, [{project_id:5, name:'project_5', is_private:true, is_enabled:true}]);};
            mock.model.users.getPermissions= function(userid, projectid, cb){setImmediate(cb, null, [{permission:'die'}]);};
            project_router.when({url:'/project_5/', session:{user:{permissions:{}}}}, { render: function(req, res, page, args){
                page.should.equal('app');
                should.exist(req.project);
                req.project.should.deep.equal({id: 5, name: 'project_5'});
                args.should.deep.equal({ project: req.project, user: req.session.user });
                done();
            }});
        });
        it('Should show the project_disabled page if the project is disabled.', function(done){
            mock.model.projects.findByUrl = function(url, cb){setImmediate(cb, null, [{project_id:5, name:'project_5', is_private:false, is_enabled:false}]);};
            project_router.when('/project_5/', { render: function(req, res, page, args){
                page.should.equal('project_disabled');
                args.should.deep.equal({project: {project_id:5, name:'project_5', is_private:false, is_enabled:false}});
                done();
            }});
        });
        it('Should next() if the project is not found.', function(done){
            mock.model.projects.findByUrl = function(url, cb){setImmediate(cb, null, []);};
            project_router.when('/project_5/', { next: function(req, res, err){
                should.not.exist(err);
                done();
            }});
        });
        it('Should fail if failed getting the project.', function(done){
            mock.model.projects.findByUrl = function(url, cb){setImmediate(cb, new Error('I am error'));};
            project_router.when('/project_5/', { next: function(req, res, err){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            }});
        });
    });        
});
