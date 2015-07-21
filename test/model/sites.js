/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";

var chai = require('chai'), should = chai.should(), expect = chai.expect;
var async = require('async');
var sinon = require('sinon');
var mock_mysql = require('../mock_tools/mock_mysql');
var jsonwebtoken = require('jsonwebtoken');

var pre_wire = require('../mock_tools/pre_wire');

var mock_jsonwebtoken = {
    token_cache:{},
    sign: function(payload, secret, options){
        var k = JSON.stringify([payload, secret, options]);
        if(!this.token_cache[k]){
            this.token_cache[k] = jsonwebtoken.sign(payload, secret, options);
        }
        return this.token_cache[k];
    },
    decode: jsonwebtoken.decode.bind(jsonwebtoken)
};

var mock_config = {
    tokens:{
        secret:'123',
        options:{}
    },
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
var sites = pre_wire('../../model/sites', {
    '../../config' : function (key){ return mock_config[key]; },
    '../../utils/dbpool' :  dbpool,
    'mysql' : mock_mysql,
    'jsonwebtoken' : mock_jsonwebtoken
});

describe('Sites', function(){
    var site={site_id:5173, name:'site', project_id:1, lat:1, lon:1, alt:1};
    describe('findById', function(){
        beforeEach(function(){
            mock_mysql.pool.cache = {};
        });
        
        it('Should find a site given its id', function(done){
            dbpool.pool.cache[
                "SELECT * FROM sites WHERE site_id = 5173"
            ]={value:[site]};
            
            sites.findById(5173, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([site]);
                done();
            });
        });
    });
    
    describe('insert', function(){
        var insertSite;
        
        beforeEach(function(){
            mock_mysql.pool.cache = {};
            insertSite = {
                name:'site', 
                project_id:1, 
                lat:2, 
                lon:3, 
                alt:4
            };
        });
        
        it('Should insert a site given the data', function(done){
            dbpool.pool.cache[
                "INSERT INTO sites \n" +
                "SET `name` = 'site', `project_id` = 1, `lat` = 2, `lon` = 3, `alt` = 4, `site_type_id` = 2"
            ]={value:{insertId:101}};
            
            sites.insert(insertSite, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({insertId:101});
                done();
            });
        });
        
        var siteRequired = ['name', 'project_id', 'lat', 'lon', 'alt'];
        siteRequired.forEach(function(key){
            it('Should fail if '+key+' is not given', function(done){
                delete insertSite[key];
                
                sites.insert(insertSite, function(err, results){
                    should.exist(err);
                    err.message.should.have.string(key);
                    should.not.exist(results);
                    done();
                });
            });
        });
    });
    describe('update', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should update a site given the data', function(done){
            dbpool.pool.cache[
                "UPDATE sites \n" + 
                "SET `project_id` = 1, `name` = 'site', `lat` = 1, `lon` = 1, `alt` = 1 \n" + 
                "WHERE site_id = 5173"
            ]={value:{affectedRows:1}};
            sites.update(site, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({affectedRows:1});
                done();
            });
        });
        it('site_id parameter is required', function(done){
            dbpool.pool.cache[
                "UPDATE sites \n" + 
                "SET `project_id` = 1, `name` = 'site', `lat` = 1, `lon` = 1, `alt` = 1, `site_type_id` = 2 \n" + 
                "WHERE site_id = 5173"
            ]={value:{affectedRows:1}};
            var s={};
            for(var i in site){s[i]=site[i];}
            delete s.site_id;            
            sites.update(s, function(err, results){
                should.exist(err);
                should.not.exist(results);
                done();
            });
        });
        it('site_id parameter can also be given as id', function(done){
            dbpool.pool.cache[
                "UPDATE sites \n" + 
                "SET `project_id` = 1, `name` = 'site', `lat` = 1, `lon` = 1, `alt` = 1 \n" + 
                "WHERE site_id = 5173"
            ]={value:{affectedRows:1}};
            var s={};
            for(var i in site){s[i]=site[i];}
            s.id = s.site_id;
            delete s.site_id;            
            sites.update(s, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({affectedRows:1});
                done();
            });
        });
    });
    describe('exists', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Reports wether a given site exists in a project or not', function(done){
            dbpool.pool.cache[
                "SELECT count(*) as count \n" +
                "FROM sites \n" +
                "WHERE name = 'site' \n" +
                "AND project_id = 1"
            ]={value:[{count:1}]};
            sites.exists('site', 1, function(err, results){
                should.not.exist(err);
                results.should.equal(true);
                done();
            });
        });
        it('Should pass along any sql errors.', function(done){
            sites.exists('site', 1, function(err, results){
                should.exist(err);
                should.not.exist(results);
                done();
            });
        });
    });
    describe('removeFromProject', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should remove a given site from the database if the given project is the site\'s project and it has no recordings.', function(done){
            dbpool.pool.cache["SELECT * FROM sites WHERE site_id = 5173"]={value:[site]};
            dbpool.pool.cache[
                "SELECT COUNT( r.recording_id ) as rec_count\n" +
                "FROM sites AS s \n" +
                "LEFT JOIN recordings AS r ON s.site_id = r.site_id  \n" +
                "WHERE s.site_id = 5173\n" +
                "GROUP BY s.site_id"
            ]={value:[{rec_count:0}]};
            dbpool.pool.cache["DELETE FROM sites \nWHERE site_id = 5173"]={value:{affectedRows:1}};
            sites.removeFromProject(5173, 1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({affectedRows:1});
                done();
            });
        });
        it('Should move a given site to the dumpster project if the given project is the site\'s project and it has recordings.', function(done){
            dbpool.pool.cache["SELECT * FROM sites WHERE site_id = 5173"]={value:[site]};
            dbpool.pool.cache[
                "SELECT COUNT( r.recording_id ) as rec_count\n" +
                "FROM sites AS s \n" +
                "LEFT JOIN recordings AS r ON s.site_id = r.site_id  \n" +
                "WHERE s.site_id = 5173\n" +
                "GROUP BY s.site_id"
            ]={value:[{rec_count:1}]};
            dbpool.pool.cache["UPDATE sites \nSET `project_id` = 1, `published` = false \nWHERE site_id = 5173"]={value:{affectedRows:1}};
            sites.removeFromProject(5173, 1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({affectedRows:1});
                done();
            });
        });
        it('Should remove a given (site_id, project_id) entry from project_imported_sites if the project is not the site\'s project.', function(done){
            dbpool.pool.cache["SELECT * FROM sites WHERE site_id = 5173"]={value:[site]};
            dbpool.pool.cache["DELETE FROM project_imported_sites \nWHERE site_id = 5173 \nAND project_id = 2"]={value:{affectedRows:1}};
            sites.removeFromProject(5173, 2, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({affectedRows:1});
                done();
            });
        });
        it('Should fail if given site is not found.', function(done){
            dbpool.pool.cache["SELECT * FROM sites WHERE site_id = 5174"]={value:[]};
            sites.removeFromProject(5174, 1, function(err, results){
                should.exist(err);
                should.not.exist(results);
                done();
            });
        });
        it('Should pass along any errors while fetching the site.', function(done){
            sites.removeFromProject(5174, 1, function(err, results){
                should.exist(err);
                should.not.exist(results);
                done();
            });
        });
        it('Should fail if site_id is falsey.', function(done){
            sites.removeFromProject(0, 1, function(err, results){
                should.exist(err);
                should.not.exist(results);
                done();
            });
        });
        it('Should fail if project_id is falsey.', function(done){
            sites.removeFromProject(5173, 0, function(err, results){
                should.exist(err);
                should.not.exist(results);
                done();
            });
        });
    });
    describe('listPublished', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should return the list of published sites', function(done){
            dbpool.pool.cache[
                "SELECT p.name AS project_name, \n" +
                "       p.project_id, \n" +
                "       u.login AS username, \n" +
                "       s.name, \n" +
                "       s.lat, \n" +
                "       s.lon, \n" +
                "       s.site_id AS id, \n" +
                "       count( r.recording_id ) as rec_count \n" +
                "FROM sites AS s \n" +
                "JOIN projects AS p ON s.project_id = p.project_id \n" +
                "JOIN users AS u ON p.owner_id = u.user_id \n" +
                "LEFT JOIN recordings AS r ON s.site_id = r.site_id \n" +
                "WHERE s.published = 1 \n" +
                "GROUP BY s.site_id"
            ]={value:[site]};
            sites.listPublished(function(err, results){
                should.not.exist(err);
                results.should.deep.equal([site]);
                done();
            });
        });
    });
    describe('haveRecordings', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Reports wether a given site has recordings or not', function(done){
            dbpool.pool.cache[
                "SELECT COUNT( r.recording_id ) as rec_count\n" +
                "FROM sites AS s \n" +
                "LEFT JOIN recordings AS r ON s.site_id = r.site_id  \n" +
                "WHERE s.site_id = 5173\n" +
                "GROUP BY s.site_id"
            ]={value:[{rec_count:1}]};
            sites.haveRecordings(5173, function(err, results){
                should.not.exist(err);
                results.should.equal(true);
                done();
            });
        });
        it('Should pass along any sql errors.', function(done){
            sites.haveRecordings(5173, function(err, results){
                should.exist(err);
                should.not.exist(results);
                done();
            });
        });
    });
    describe('importSiteToProject', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should add a given site to the given project\'s imported sites list.', function(done){
            dbpool.pool.cache["SELECT * FROM sites WHERE site_id = 5173"]={value:[site]};
            dbpool.pool.cache["INSERT INTO project_imported_sites(site_id, project_id) \nVALUES (5173,2)"]={value:{affectedRows:1}};
            sites.importSiteToProject(5173, 2, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({affectedRows:1});
                done();
            });
        });
        it('Should fail if the a given site is from the given project.', function(done){
            dbpool.pool.cache["SELECT * FROM sites WHERE site_id = 5173"]={value:[site]};
            sites.importSiteToProject(5173, 1, function(err, results){
                should.exist(err);
                should.not.exist(results);
                done();
            });
        });
        it('Should fail if given site is not found.', function(done){
            dbpool.pool.cache["SELECT * FROM sites WHERE site_id = 5174"]={value:[]};
            sites.importSiteToProject(5174, 1, function(err, results){
                should.exist(err);
                should.not.exist(results);
                done();
            });
        });
        it('Should pass along any errors while fetching the site.', function(done){
            sites.importSiteToProject(5174, 1, function(err, results){
                should.exist(err);
                should.not.exist(results);
                done();
            });
        });
        it('Should fail if site_id is falsey.', function(done){
            sites.importSiteToProject(0, 1, function(err, results){
                should.exist(err);
                should.not.exist(results);
                done();
            });
        });
        it('Should fail if project_id is falsey.', function(done){
            sites.importSiteToProject(5173, 0, function(err, results){
                should.exist(err);
                should.not.exist(results);
                done();
            });
        });
    });
    describe('generateToken', function(){
        beforeEach(function(){
            mock_mysql.pool.cache = {};
            mock_jsonwebtoken.token_cache = {};
        });
        it('Should generate a token for a given site', function(done){
            var t = mock_jsonwebtoken.sign({ 
                project: site.project_id,
                site: site.site_id
            }, mock_config.tokens.secret, mock_config.tokens.options);
            var dt = mock_jsonwebtoken.decode(t);
            dbpool.pool.cache[
                "UPDATE sites \n" +
                "SET token_created_on = "+dt.iat+" \n" +
                "WHERE site_id = 5173"
            ]={value:{affectedRows:1}};
            sites.generateToken(site, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({
                    "type": "A2Token",
                    "name": site.name,
                    "created": dt.iat,
                    "expires": 0,
                    "token": t                    
                });
                done();
            });
        });
        it('Fails if site cannot be updated in the database.', function(done){
            sites.generateToken(site, function(err, results){
                should.exist(err);
                should.not.exist(results);
                done();
            });
        });
    });
    describe('revokeToken', function(){
        beforeEach(function(){
            mock_mysql.pool.cache = {};
        });
        it('Should revoke the associiated token of a given site', function(done){
            dbpool.pool.cache[
                "UPDATE sites \n" +
                "SET token_created_on = NULL \n" +
                "WHERE site_id = 5173"
            ]={value:{affectedRows:1}};
            sites.revokeToken(site, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({affectedRows:1});
                done();
            });
        });
    });
});
