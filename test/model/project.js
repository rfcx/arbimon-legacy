/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";

var chai = require('chai'), should = chai.should(), expect = chai.expect;
var async = require('async');
var sinon = require('sinon');
var mock_mysql = require('../mock_tools/mock_mysql');

var pre_wire = require('../mock_tools/pre_wire');

var mock_config = {
    db: {
        "host" : "1.2.3.4",
        "user" : "user",
        "password" : "password",
        "database" : "a2db",
        "timezone" : "Z"
    }
};
var dbpool = pre_wire('../../utils/dbpool', {
    '../../config' : function (key){ return mock_config[key]; },
    'mysql' : mock_mysql
});
var projects = pre_wire('../../model/projects', {
    '../../config' : function (key){ return mock_config[key]; },
    '../../utils/dbpool' :  dbpool,
    'mysql' : mock_mysql,
});

describe('Project', function(){
    var project={project_id:1, url:'project/url', name:'project'};
    describe('listAll', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should return the list of all projects.', function(done){
            dbpool.pool.cache[
                "SELECT name, url, description, is_private, is_enabled \n" +
                "FROM projects"
            ]={value:[project]};
            projects.listAll(function(err, results){
                should.not.exist(err);
                results.should.deep.equal([project]);
                done();
            });
        });
    });
    describe('findById', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should return a project given its id.', function(done){
            dbpool.pool.cache[
                "SELECT * FROM projects WHERE project_id = 1"
            ]={value:[project]};
            projects.findById(1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([project]);
                done();
            });
        });
    });
    describe('findByUrl', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should return a project given its url.', function(done){
            dbpool.pool.cache[
                "SELECT * FROM projects WHERE url = 'project/url'"
            ]={value:[project]};
            projects.findByUrl('project/url', function(err, results){
                should.not.exist(err);
                results.should.deep.equal([project]);
                done();
            });
        });
    });
    describe('findByName', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should return a project given its name.', function(done){
            dbpool.pool.cache[
                "SELECT * FROM projects WHERE name = 'project'"
            ]={value:[project]};
            projects.findByName('project', function(err, results){
                should.not.exist(err);
                results.should.deep.equal([project]);
                done();
            });
        });
    });
    describe('getProjectSites', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should return a list of sites in the given project.', function(done){
            dbpool.pool.cache[
                "SELECT s.site_id as id, \n" + 
                "       s.name, \n" + 
                "       s.lat, \n" + 
                "       s.lon, \n" + 
                "       s.alt, \n" + 
                "       s.published, \n" + 
                "       COUNT( r.recording_id ) as rec_count, \n" + 
                "       s.project_id != 1 AS imported, \n" + 
                "       s.token_created_on \n" + 
                "FROM sites AS s \n" + 
                "LEFT JOIN project_imported_sites as pis ON s.site_id = pis.site_id AND pis.project_id = 1 \n" + 
                "LEFT JOIN recordings AS r ON s.site_id = r.site_id \n" + 
                "WHERE (s.project_id = 1 \n" + 
                "OR pis.project_id = 1) \n" + 
                "GROUP BY s.site_id"
            ]={value:['site1', 'site2']};
            projects.getProjectSites(1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal(['site1', 'site2']);
                done();
            });
        });
        it('Requires project_id to be a number.', function(done){
            projects.getProjectSites('1', function(err, results){
                should.exist(err);
                should.not.exist(results);
                done();
            });
        });
    });
    describe('insert', function(){
    });
    describe('update', function(){
    });
    describe('insertNews', function(){
    });
    describe('getProjectClasses', function(){
    });
    describe('insertClass', function(){
    });
    describe('removeClasses', function(){
    });
    describe('getUsers', function(){
    });
    describe('addUser', function(){
    });
    describe('changeUserRole', function(){
    });
    describe('modelList', function(){
    });
    describe('classifications', function(){
    });
    describe('classificationName', function(){
    });
    describe('classificationDelete', function(){
    });
    describe('classificationCsvData', function(){
    });
    describe('classificationErrors', function(){
    });
    describe('classificationDetail', function(){
    });
    describe('classificationDetailMore', function(){
    });
    describe('trainingSets', function(){
    });
    describe('validationSets', function(){
    });
    describe('validationsStats', function(){
    });
    describe('validationsCount', function(){
    });
    describe('modelValidationUri', function(){
    });
    describe('removeUser', function(){
    });
    describe('availableRoles', function(){
    });
    describe('totalRecordings', function(){
    });
});
