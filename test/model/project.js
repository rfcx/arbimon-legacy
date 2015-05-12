/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";

var chai = require('chai'), should = chai.should(), expect = chai.expect;
var async = require('async');
var sinon = require('sinon');
var mock_mysql = require('../mock_tools/mock_mysql');
var mock_aws = require('../mock_tools/mock_aws');

var pre_wire = require('../mock_tools/pre_wire');

var mock_config = {
    aws: {
        bucketName : 'kfc_bucket'
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
var projects = pre_wire('../../model/projects', {
    '../../config' : function (key){ return mock_config[key]; },
    '../../utils/dbpool' :  dbpool,
    'mysql' : mock_mysql,
});

var mock_debug=function(){
    if(mock_debug.__spy__){
        mock_debug.__spy__.apply(mock_debug.__spy__, Array.prototype.slice.call(arguments));
    }
};

var debug=console.log;
projects.__set__({
    debug: mock_debug,
    AWS: mock_aws,
    species: {
        cache:{
            'Specius exemplus': { id:59335, name:'Specius exemplus'},
            'error' : new Error('I am error')
        },
        findByName: function(name, callback){
            if(!this.cache[name]){
                setImmediate(callback, null, []);
            } else {
                if(this.cache[name].message){
                    setImmediate(callback, this.cache[name]);
                } else {
                    setImmediate(callback, null, [this.cache[name]]);
                }                
            }
        }
    },
    songtypes: {
        cache:{
            'Common Song':{id:5036, name:'Common Song'},
            'error' : new Error('I am error')
        },
        findByName: function(name, callback){
            if(!this.cache[name]){
                setImmediate(callback, null, []);
            } else {
                if(this.cache[name].message){
                    setImmediate(callback, this.cache[name]);
                } else {
                    setImmediate(callback, null, [this.cache[name]]);
                }                
            }
        }
    },
    s3: new mock_aws.S3()
});

var project = {
    project_id: 1,
    url: 'project/url',
    name: 'project',
    description: 'description',
    owner_id: 9393,
    project_type_id: 1,
    is_private: 1
};
var insertproject = {
    id: 1,
    url: 'project/url',
    name: 'project',
    description: 'description',
    owner_id: 9393,
    project_type_id: 1,
    is_private: 1
};
var news = {
    user_id: 9393,
    project_id: 1,
    data: 'news #5',
    news_type_id: 1
};

describe('Project', function(){
    
    beforeEach(function(){
        mock_mysql.pool.cache = {};
    });
    
    describe('listAll', function(){
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
         
        
        it('Should insert a project given the data', function(done){
            dbpool.pool.cache[
                "INSERT INTO projects \n" +
                "SET `url` = 'project/url', `name` = 'project', `description` = 'description', `owner_id` = 9393, `project_type_id` = 1, `is_private` = 1"
            ]={value:{insertId:101}};
            projects.insert(insertproject, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({insertId:101});
                done();
            });
        });
        
        var pdata = {
            url:'project/url', 
            name:'project', 
            description:'description', 
            owner_id:9393, 
            project_type_id:1, 
            is_private:1
        };
        
        Object.keys(pdata).forEach(function(key){
            var obj={};
            for(var k in pdata){
                if(k != key){
                    obj[k] = pdata[k];
                }
            }
            it('Should fail if '+key+' is not given', function(done){
                projects.insert(obj, function(err, results){
                    should.exist(err);
                    err.message.should.equal("required field '"+key+"' missing");
                    should.not.exist(results);
                    done();
                });
            });
        });
    });
    
    describe('update', function(){
         
        
        it('Should update a project given the data', function(done){
            dbpool.pool.cache[
                "UPDATE projects \n" +
                "SET `url` = 'project/url', `name` = 'project', `description` = 'description', `owner_id` = 9393, `project_type_id` = 1, `is_private` = 1 \n" +
                "WHERE project_id = 1"
            ]={value:{affectedRows:1}};
            projects.update(project, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({affectedRows:1});
                done();
            });
        });
        
        it('project_id parameter is required', function(done){
            var p={};
            for(var i in project){ p[i]=project[i]; }
            delete p.project_id;
            projects.update(p, function(err, results){
                should.exist(err);
                err.name.should.equal('ValidationError');
                err.message.should.contain('project_id');
                
                should.not.exist(results);
                done();
            });
        });
        
        it('Should fail if there are any invalid attributes/values in project object', function(done){
            var p={};
            for(var i in project){p[i]=project[i];}
            p.zebra = 1;
            projects.update(p, function(err, results){
                should.exist(err);
                err.name.should.equal('ValidationError');
                err.message.should.contain('zebra');
                should.not.exist(results);
                done();
            });
        });
        
    });
    
    describe('insertNews', function(){
        
        beforeEach(function(){
            mock_mysql.pool.cache = {};
            delete mock_mysql.pool.query_callback;
            sinon.stub(console, 'error', function(){
                if(console.error.__spy__){
                    console.error.__spy__.apply(null, Array.prototype.slice.apply(arguments));
                }
            });
        });
        
        afterEach(function(){
            delete mock_debug.__spy__;            
            console.error.restore();
        });
        
        it('Should insert a project news item', function(done){
            dbpool.pool.cache[
                "INSERT INTO project_news \n" +
                "SET user_id = 9393, project_id = 1, data = 'news #5', news_type_id = 1"
            ]={value:{insertId:1}};
            projects.insertNews(news, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({insertId:1});
                done();
            });
        });
        
        it('Callback is optional', function(done){
            mock_mysql.pool.query_callback = function(){
                done();
            };
            dbpool.pool.cache[
                "INSERT INTO project_news \n" +
                "SET user_id = 9393, project_id = 1, data = 'news #5', news_type_id = 1"
            ] = { value: { insertId: 1 } };
            projects.insertNews(news);
        });
        
        Object.keys(news).forEach(function(key){
            var obj={};
            for(var k in news){
                if(k != key){
                    obj[k] = news[k];
                }
            }
            it('Should callback with error if '+key+' is not given and a callback is given', function(done){
                projects.insertNews(obj, function(err, results){
                    should.exist(err);
                    err.name.should.equal('ValidationError');
                    err.message.should.contain(key);
                    should.not.exist(results);
                    done();
                });
            });
            it('Should write to console.error if '+key+' is not given and no callback is given', function(done){
                console.error.__spy__ = function(msg){
                    arguments.length.should.equal(1);
                    should.exist(msg);
                    msg.name.should.equal('ValidationError');
                    msg.message.should.contain(key);
                    done();
                };
                projects.insertNews(obj);
            });
        });
        
        it('Should callback with error if query failed', function(done){
            projects.insertNews(news, function(err, results){
                should.exist(err);
                err.message.should.equal("Query not in cache : INSERT INTO project_news \nSET user_id = 9393, project_id = 1, data = 'news #5', news_type_id = 1");
                should.not.exist(results);
                done();
            });
        });
        it('Should write to console.error is query failed and no callback is given', function(done){
            console.error.__spy__ = function(msg){
                arguments.length.should.equal(1);
                should.exist(msg);
                msg.message.should.equal("Query not in cache : INSERT INTO project_news \nSET user_id = 9393, project_id = 1, data = 'news #5', news_type_id = 1");
                done();
            };
            projects.insertNews(news);
        });
    });
    describe('getProjectClasses', function(){
        beforeEach(function() {
            mock_mysql.pool.cache = {};
        });
        
        it('Should return the list of all the class in the project.', function(done){
            dbpool.pool.cache[
                "SELECT pc.project_class_id as id, \n" +
                "       pc.species_id as species, \n" +
                "       pc.songtype_id as songtype, \n" +
                "       st.taxon, \n"+
                "       sp.scientific_name as species_name, \n" +
                "       so.songtype as songtype_name \n" +
                "FROM project_classes AS pc \n" +
                "JOIN species AS sp on sp.species_id = pc.species_id \n" +
                "JOIN songtypes AS so on so.songtype_id = pc.songtype_id \n" +
                "JOIN species_taxons AS st ON st.taxon_id = sp.taxon_id \n" +
                "WHERE pc.project_id = 1 ORDER BY st.taxon, sp.scientific_name"
            ]={value:['class1','class2']};
            projects.getProjectClasses(1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal(['class1','class2']);
                done();
            });
        });
        it('Query can be narrowed down to a specific class in the project.', function(done){
            dbpool.pool.cache[
                "SELECT pc.project_class_id as id, \n" +
                "       pc.species_id as species, \n" +
                "       pc.songtype_id as songtype, \n" +
                "       st.taxon, \n"+
                "       sp.scientific_name as species_name, \n" +
                "       so.songtype as songtype_name \n" +
                "FROM project_classes AS pc \n" +
                "JOIN species AS sp on sp.species_id = pc.species_id \n" +
                "JOIN songtypes AS so on so.songtype_id = pc.songtype_id \n" +
                "JOIN species_taxons AS st ON st.taxon_id = sp.taxon_id \n" +
                "WHERE pc.project_id = 1\n" +
                "  AND pc.project_class_id = 1 ORDER BY st.taxon, sp.scientific_name"
            ]={value:['class1']};
            projects.getProjectClasses(1, 1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal(['class1']);
                done();
            });
        });
    });
    describe('insertClass', function(){
         
        it('Should insert/add a class into a project.', function(done){
            dbpool.pool.cache[
                "SELECT count(*) as count \n" +
                "FROM project_classes \n" +
                "WHERE project_id = 1 \n" +
                "AND species_id = 59335 \n" +
                "AND songtype_id = 5036"
            ]={value:[{count:0}]};
            dbpool.pool.cache[
                "INSERT INTO project_classes \n" +
                "SET project_id = 1, species_id = 59335, songtype_id = 5036"
            ]={value:{insertId:1}};
            var project_class = {species:'Specius exemplus', songtype: 'Common Song', project_id: 1};
            projects.insertClass(project_class, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({insertId:1});
                done();
            });
        });
        it('Should callback result with error message is class is already in the project.', function(done){
            dbpool.pool.cache[
                "SELECT count(*) as count \n" +
                "FROM project_classes \n" +
                "WHERE project_id = 1 \n" +
                "AND species_id = 59335 \n" +
                "AND songtype_id = 5036"
            ]={value:[{count:1}]};
            var project_class = {species:'Specius exemplus', songtype: 'Common Song', project_id: 1};
            projects.insertClass(project_class, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({error:'class already in project'});
                done();
            });
        });
        
        it('Should fail if "class.species" is not of correct type.', function(done){        
            projects.insertClass({species:2, songtype: 'Common Song', project_id: 1}, function(err, results){
                should.exist(err);
                err.name.should.equal('ValidationError');
                err.message.should.contain('species');
                done();
            });
        });
        
        it('Should fail if "class.songtype" if not of correct type.', function(done){
            projects.insertClass({species:'Specius exemplus', songtype: 2, project_id: 1}, function(err, results){
                should.exist(err);
                err.name.should.equal('ValidationError');
                err.message.should.contain('songtype');
                done();
            });
        });
        
        it('Should fail if "class.project_id" is not of correct type.', function(done){        
            projects.insertClass({species:'Specius exemplus', songtype: 'Common Song', project_id: 'qwerty'}, function(err, results){
                should.exist(err);
                err.name.should.equal('ValidationError');
                err.message.should.contain('project_id');
                done();
            });
        });
        
        it('Should fail if fetch species data fails.', function(done){        
            var project_class = {species:'error', songtype: 'Common Song', project_id: 1};
            projects.insertClass(project_class, function(err, results){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
        it('Should fail if fetch songtype data fails.', function(done){        
            var project_class = {species:'Specius exemplus', songtype: 'error', project_id: 1};
            projects.insertClass(project_class, function(err, results){
                should.exist(err);
                err.message.should.equal('I am error');
                done();
            });
        });
        it('Should fail if species is not in database.', function(done){
            var project_class = {species:'non-existent', songtype: 'Common Song', project_id: 1};
            projects.insertClass(project_class, function(err, results){
                should.exist(err);
                err.message.should.equal('species \'non-existent\' not in system');
                done();
            });
        });
        it('Should fail if songtype is not in database.', function(done){        
            var project_class = {species:'Specius exemplus', songtype: 'non-existent', project_id: 1};
            projects.insertClass(project_class, function(err, results){
                should.exist(err);
                err.message.should.equal('songtype \'non-existent\' not in system');
                done();
            });
        });
        it('Should fail if class checking query fails.', function(done){
            var project_class = {species:'Specius exemplus', songtype: 'Common Song', project_id: 1};
            projects.insertClass(project_class, function(err, results){
                should.exist(err);
                done();
            });
        });
        it('Should fail if class insertion query fails.', function(done){
            dbpool.pool.cache[
                "SELECT count(*) as count \n" +
                "FROM project_classes \n" +
                "WHERE project_id = 1 \n" +
                "AND species_id = 59335 \n" +
                "AND songtype_id = 5036"
            ]={value:[{count:0}]};
            var project_class = {species:'Specius exemplus', songtype: 'Common Song', project_id: 1};
            projects.insertClass(project_class, function(err, results){
                should.exist(err);
                done();
            });
        });
    });
    
    
    describe('removeClasses', function(){
         
        it('Should remove an array of (class, project) identifiers.', function(done){
            dbpool.pool.cache[
                "DELETE FROM project_classes \n" +
                "WHERE project_class_id IN (41255)"
            ]={value:{affectedRows:1}};
            
            projects.removeClasses([41255], function(err, results){
                should.not.exist(err);
                results.should.deep.equal({affectedRows:1});
                done();
            });
        });
        
        it('Should fail if no (class, project) identifiers are given.', function(done){
            projects.removeClasses([], function(err, results){
                should.exist(err);
                err.name.should.equal('ValidationError');
                err.message.should.equal('"value" must contain at least 1 items');
                done();
            });
        });
        
    });
    
    describe('getUsers', function(){
         
        it('Should return a list of sites in the given project.', function(done){
            dbpool.pool.cache[
                "SELECT u.login AS username, \n" +
                "       u.user_id AS id, \n" +
                "       u.email, \n" +
                "       r.name AS rolename \n" +
                "FROM users AS u \n" +
                "JOIN user_project_role AS upr ON u.user_id = upr.user_id \n" +
                "JOIN roles AS r on upr.role_id = r.role_id \n" +
                "WHERE upr.project_id = 1"
            ]={value:['user1', 'user2']};
            projects.getUsers(1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal(['user1', 'user2']);
                done();
            });
        });
        it('Requires project_id to be a number.', function(done){
            projects.getUsers('1', function(err, results){
                should.exist(err);
                should.not.exist(results);
                done();
            });
        });
    });
    describe('addUser', function(){
         
        it('Should add a user with a role into a project.', function(done){
            dbpool.pool.cache[
                "INSERT INTO user_project_role \nSET user_id = 9393, role_id = 1, project_id = 1"
            ]={value:{insertId:1}};
            projects.addUser({user_id:9393, project_id:1, role_id:1}, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({insertId:1});
                done();
            });
        });
        var upr={user_id:9393, project_id:1, role_id:1};
        Object.keys(upr).forEach(function(key){
            var obj={};
            for(var k in upr){
                if(k != key){
                    obj[k] = upr[k];
                }
            }
            it('Should fail if '+key+' is not given', function(done){
                projects.addUser(obj, function(err, results){
                    should.exist(err);
                    err.name.should.equal('ValidationError');
                    err.message.should.contain(key);
                    should.not.exist(results);
                    done();
                });
            });
        });
    });
    describe('changeUserRole', function(){
         
        it('Should change a users role in a project.', function(done){
            dbpool.pool.cache[
                "UPDATE user_project_role \n" +
                "SET role_id = 1 \n" +
                "WHERE user_id = 9393 \n" +
                "AND project_id = 1"
            ]={value:{insertId:1}};
            projects.changeUserRole({user_id:9393, project_id:1, role_id:1}, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({insertId:1});
                done();
            });
        });
        var upr={user_id:9393, project_id:1, role_id:1};
        
        Object.keys(upr).forEach(function(key){
            var obj={};
            for(var k in upr){
                if(k != key){
                    obj[k] = upr[k];
                }
            }
            it('Should fail if '+key+' is not given', function(done){
                projects.changeUserRole(obj, function(err, results){
                    should.exist(err);
                    err.name.should.equal('ValidationError');
                    err.message.should.contain(key);
                    should.not.exist(results);
                    done();
                });
            });
        });
    });
    describe('modelList', function(){
         
        it('Should return a list of models in a project given its url.', function(done){
            dbpool.pool.cache[
                "SELECT m.model_id, CONCAT(UCASE(LEFT(m.name, 1)), SUBSTRING(m.name, 2)) as mname  ,UNIX_TIMESTAMP( m.`date_created` )*1000 as date  , CONCAT(CONCAT(UCASE(LEFT(u.firstname, 1)), SUBSTRING(u.firstname, 2)) ,  ' ', CONCAT(UCASE(LEFT(u.lastname, 1)), SUBSTRING(u.lastname, 2)) ) as muser  , mt.name as mtname  FROM `models` as m,`model_types` as mt , `users` as u , `projects` as p  WHERE p.url  = '/project_1/' and m.`model_type_id` = mt.`model_type_id` and m.user_id = u.user_id  and p.project_id = m.project_id and m.deleted = 0"
            ]={value:['model1', 'model2']};
            projects.modelList('/project_1/', function(err, results){
                should.not.exist(err);
                results.should.deep.equal(['model1', 'model2']);
                done();
            });
        });
    });
    describe('classifications', function(){
         
        it('Should return a list of classifications in a project given its url.', function(done){
            dbpool.pool.cache[
                "SELECT UNIX_TIMESTAMP( j.`date_created` )*1000  as date   , j.`job_id`  , pl.`name` as playlistName, CONCAT(UCASE(LEFT(mode.`name`, 1)), SUBSTRING(mode.`name`, 2))  as modname   , CONCAT(UCASE(LEFT(jpc.`name`, 1)), SUBSTRING(jpc.`name`, 2))  as cname   , CONCAT(CONCAT(UCASE(LEFT(u.firstname, 1)), SUBSTRING(u.firstname, 2)) ,  ' ', CONCAT(UCASE(LEFT(u.lastname, 1)), SUBSTRING(u.lastname, 2)) ) as muser  from  `playlists`  as pl, `models` as mode , `jobs` as j ,`job_params_classification` as jpc , `projects` as p , `users` as u  WHERE pl.`playlist_id` = jpc.`playlist_id` and mode.`model_id` = jpc.`model_id` and p.url  = '/project_1/' and j.`project_id` = p.`project_id`  and  j.`job_id` = jpc.`job_id` and j.`job_type_id` = 2 and j.`completed` = 1 and u.`user_id` = j.`user_id`"
            ]={value:['c1', 'c2']};
            projects.classifications('/project_1/', function(err, results){
                should.not.exist(err);
                results.should.deep.equal(['c1', 'c2']);
                done();
            });
        });
    });
    describe('classificationName', function(){
         
        it('Should return the name and project of a classification given its id.', function(done){
            dbpool.pool.cache[
                "select  REPLACE(lower(c.`name`),' ','_')  as name , j.`project_id` as pid   from   `job_params_classification`  c , `jobs` j where c.`job_id` = j.`job_id` and c.`job_id` = 1"
            ]={value:[{name:'cl1', project_id:1}]};
            projects.classificationName(1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{name:'cl1', project_id:1}]);
                done();
            });
        });
    });
    
    describe('classificationDelete', function(){
        
        beforeEach(function(){
            mock_mysql.pool.cache = {};
            delete mock_aws.S3.buckets.kfc_bucket;
        });
        
        it('Should remove a classification given its id.', function(done){
            dbpool.pool.cache[
                "SELECT `uri` FROM `models` WHERE `model_id` = (SELECT `model_id` FROM `job_params_classification` WHERE `job_id` = '1')"
            ]={value:[{uri:'project_1/models/model_1.mod'}]};
            
            dbpool.pool.cache[
                "SELECT `uri` FROM `recordings` WHERE `recording_id` in (SELECT `recording_id` FROM `classification_results` WHERE `job_id` = '1') "
            ]={value:[]};
            
            dbpool.pool.cache[
                "DELETE FROM `classification_results` WHERE `job_id` ='1'"
            ]={value:{affectedRows:1}};
            
            dbpool.pool.cache[
                "DELETE FROM `classification_stats` WHERE `job_id` = '1'"
            ]={value:{affectedRows:1}};
            
            dbpool.pool.cache[
                "DELETE FROM `job_params_classification` WHERE `job_id` ='1'"
            ]={value:{affectedRows:1}};            
            
            projects.classificationDelete("'1'", function(err, results){
                should.not.exist(err);
                results.should.deep.equal({data:"Classification deleted succesfully"});
                done();
            });
        });
        
        it('Should fail if model query fails', function(done){
            projects.classificationDelete("'1'", function(err, results){
                should.exist(err);
                done();
            });
        });
        
        it('Should fail if recordings query fails', function(done){
            dbpool.pool.cache[
                "SELECT `uri` FROM `models` WHERE `model_id` = (SELECT `model_id` FROM `job_params_classification` WHERE `job_id` = '1')"
            ]={value:[{uri:'project_1/models/model_1.mod'}]};
            projects.classificationDelete("'1'", function(err, results){
                should.exist(err);
                done();
            });
        });
        
        it('Should fail if delete classification_results query fails', function(done){
            dbpool.pool.cache[
                "SELECT `uri` FROM `models` WHERE `model_id` = (SELECT `model_id` FROM `job_params_classification` WHERE `job_id` = '1')"
            ]={value:[{uri:'project_1/models/model_1.mod'}]};
            dbpool.pool.cache[
                "SELECT `uri` FROM `recordings` WHERE `recording_id` in (SELECT `recording_id` FROM `classification_results` WHERE `job_id` = '1') "
            ]={value:[]};
            projects.classificationDelete("'1'", function(err, results){
                should.exist(err);
                done();
            });
        });
        it('Should fail if delete classification_stats query fails', function(done){
            dbpool.pool.cache[
                "SELECT `uri` FROM `models` WHERE `model_id` = (SELECT `model_id` FROM `job_params_classification` WHERE `job_id` = '1')"
            ]={value:[{uri:'project_1/models/model_1.mod'}]};
            dbpool.pool.cache[
                "SELECT `uri` FROM `recordings` WHERE `recording_id` in (SELECT `recording_id` FROM `classification_results` WHERE `job_id` = '1') "
            ]={value:[]};
            dbpool.pool.cache[
                "DELETE FROM `classification_results` WHERE `job_id` ='1'"
            ]={value:{affectedRows:1}};
            projects.classificationDelete("'1'", function(err, results){
                should.exist(err);
                done();
            });
        });
        it('Should fail if delete job_params_classification query fails', function(done){
            dbpool.pool.cache[
                "SELECT `uri` FROM `models` WHERE `model_id` = (SELECT `model_id` FROM `job_params_classification` WHERE `job_id` = '1')"
            ]={value:[{uri:'project_1/models/model_1.mod'}]};
            dbpool.pool.cache[
                "SELECT `uri` FROM `recordings` WHERE `recording_id` in (SELECT `recording_id` FROM `classification_results` WHERE `job_id` = '1') "
            ]={value:[]};
            dbpool.pool.cache[
                "DELETE FROM `classification_results` WHERE `job_id` ='1'"
            ]={value:{affectedRows:1}};
            dbpool.pool.cache[
                "DELETE FROM `classification_stats` WHERE `job_id` = '1'"
            ]={value:{affectedRows:1}};
            projects.classificationDelete("'1'", function(err, results){
                should.exist(err);
                done();
            });
        });
        
        it('Should remove the vector files from any associated recordings.', function(done){
            mock_aws.S3.buckets.kfc_bucket = {
                'project_1/models/model_1/classification_1_site_1-1-1-1-1-1.wav.vector' : {}
            };
            
            dbpool.pool.cache[
                "SELECT `uri` FROM `models` WHERE `model_id` = (SELECT `model_id` FROM `job_params_classification` WHERE `job_id` = '1')"
            ]={value:[{uri:'project_1/models/model_1.mod'}]};
            
            dbpool.pool.cache[
                "SELECT `uri` FROM `recordings` WHERE `recording_id` in (SELECT `recording_id` FROM `classification_results` WHERE `job_id` = '1') "
            ]={value:[{uri:'project_1/recordings/site_1/site_1-1-1-1-1-1.wav'}]};            
            
            dbpool.pool.cache[
                "DELETE FROM `classification_results` WHERE `job_id` ='1'"
            ]={value:{affectedRows:1}};
            
            dbpool.pool.cache[
                "DELETE FROM `classification_stats` WHERE `job_id` = '1'"
            ]={value:{affectedRows:1}};
            
            dbpool.pool.cache[
                "DELETE FROM `job_params_classification` WHERE `job_id` ='1'"
            ]={value:{affectedRows:1}};            
            
            projects.classificationDelete("'1'", function(err, results){
                should.not.exist(err);
                results.should.deep.equal({data:'Classification deleted succesfully'});
                done();
            });
        });
        
        it('Should fail if bucket operations fail', function(done){
            dbpool.pool.cache[
                "SELECT `uri` FROM `models` WHERE `model_id` = (SELECT `model_id` FROM `job_params_classification` WHERE `job_id` = '1')"
            ]={value:[{uri:'project_1/models/model_1.mod'}]};
            dbpool.pool.cache[
                "SELECT `uri` FROM `recordings` WHERE `recording_id` in (SELECT `recording_id` FROM `classification_results` WHERE `job_id` = '1') "
            ]={value:[{uri:'project_1/recordings/site_1/site_1-1-1-1-1-1.wav'}]};            
            projects.classificationDelete("'1'", function(err, results){
                should.exist(err);
                done();
            });
        });
        it('Should fail if delete classification_results query fails (with recordings path)', function(done){
            mock_aws.S3.buckets.kfc_bucket = {
                'project_1/models/model_1/classification_1_site_1-1-1-1-1-1.wav.vector' : {}
            };
            dbpool.pool.cache[
                "SELECT `uri` FROM `models` WHERE `model_id` = (SELECT `model_id` FROM `job_params_classification` WHERE `job_id` = '1')"
            ]={value:[{uri:'project_1/models/model_1.mod'}]};
            dbpool.pool.cache[
                "SELECT `uri` FROM `recordings` WHERE `recording_id` in (SELECT `recording_id` FROM `classification_results` WHERE `job_id` = '1') "
            ]={value:[{uri:'project_1/recordings/site_1/site_1-1-1-1-1-1.wav'}]};            
            projects.classificationDelete("'1'", function(err, results){
                should.exist(err);
                done();
            });
        });
        it('Should fail if delete classification_stats query fails (with recordings path)', function(done){
            mock_aws.S3.buckets.kfc_bucket = {
                'project_1/models/model_1/classification_1_site_1-1-1-1-1-1.wav.vector' : {}
            };
            dbpool.pool.cache[
                "SELECT `uri` FROM `models` WHERE `model_id` = (SELECT `model_id` FROM `job_params_classification` WHERE `job_id` = '1')"
            ]={value:[{uri:'project_1/models/model_1.mod'}]};
            dbpool.pool.cache[
                "SELECT `uri` FROM `recordings` WHERE `recording_id` in (SELECT `recording_id` FROM `classification_results` WHERE `job_id` = '1') "
            ]={value:[{uri:'project_1/recordings/site_1/site_1-1-1-1-1-1.wav'}]};
            dbpool.pool.cache[
                "DELETE FROM `classification_results` WHERE `job_id` ='1'"
            ]={value:{affectedRows:1}};
            projects.classificationDelete("'1'", function(err, results){
                should.exist(err);
                done();
            });
        });
        it('Should fail if delete job_params_classification query fails (with recordings path)', function(done){
            mock_aws.S3.buckets.kfc_bucket = {
                'project_1/models/model_1/classification_1_site_1-1-1-1-1-1.wav.vector' : {}
            };
            dbpool.pool.cache[
                "SELECT `uri` FROM `models` WHERE `model_id` = (SELECT `model_id` FROM `job_params_classification` WHERE `job_id` = '1')"
            ]={value:[{uri:'project_1/models/model_1.mod'}]};
            dbpool.pool.cache[
                "SELECT `uri` FROM `recordings` WHERE `recording_id` in (SELECT `recording_id` FROM `classification_results` WHERE `job_id` = '1') "
            ]={value:[{uri:'project_1/recordings/site_1/site_1-1-1-1-1-1.wav'}]};
            dbpool.pool.cache[
                "DELETE FROM `classification_results` WHERE `job_id` ='1'"
            ]={value:{affectedRows:1}};
            dbpool.pool.cache[
                "DELETE FROM `classification_stats` WHERE `job_id` = '1'"
            ]={value:{affectedRows:1}};
            projects.classificationDelete("'1'", function(err, results){
                should.exist(err);
                done();
            });
        });
    });
    describe('classificationCsvData', function(){
         
        it('Should return the results of a classification given its id.', function(done){
            dbpool.pool.cache[
                "SELECT extract(year from r.`datetime`) year , extract(month from r.`datetime`) month , extract(day from r.`datetime`) day , extract(hour from r.`datetime`) hour , extract(minute from r.`datetime`) min ,   m.`threshold` ,  m.`uri` ,  r.`uri` ruri  ,  cr.`max_vector_value` as mvv ,SUBSTRING_INDEX(r.`uri` ,'/',-1 ) rec , cr.`present` , s.`name` , sp.`scientific_name` , st.`songtype` FROM `models` m , `job_params_classification`  jpc, `species` sp, `classification_results` cr, `recordings` r, `sites` s, `songtypes` st WHERE cr.`job_id` =1 AND jpc.`job_id` = cr.`job_id` AND jpc.`model_id` = m.`model_id` AND cr.`recording_id` = r.`recording_id` AND s.`site_id` = r.`site_id` AND sp.`species_id` = cr.`species_id` AND cr.`songtype_id` = st.`songtype_id`  "
            ]={value:['c1', 'c2']};
            projects.classificationCsvData(1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal(['c1', 'c2']);
                done();
            });
        });
    });
    describe('classificationErrorsCount', function(){
         
        it('Should return the errors of a classification given its id.', function(done){
            
            dbpool.pool.cache[
                "SELECT count(*) AS count \nFROM recordings_errors \nWHERE job_id = 1"
            ]={value:[{count:1}]};
            
            projects.classificationErrorsCount('/project_1/', 1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:1}]);
                done();
            });
        });
    });
    describe('classificationDetail', function(){
         
        it('Should return the details of a classification given its id.', function(done){
            dbpool.pool.cache[
                "SELECT c.`species_id`, \n"+
                "       c.`songtype_id`, \n"+
                "       c.`present`, \n"+
                "       CONCAT( \n"+
                "           UCASE(LEFT(st.`songtype`, 1)), \n"+
                "           SUBSTRING(st.`songtype`, 2) \n"+
                "       ) as songtype, \n"+
                "       CONCAT( \n"+
                "           UCASE(LEFT(s.`scientific_name`, 1)), \n"+
                "           SUBSTRING(s.`scientific_name`, 2) \n"+
                "       ) as scientific_name, \n"+
                "       mm.`threshold` as th \n"+
                "FROM  `models` mm, \n"+
                "      `job_params_classification`jpc, \n"+
                "      `classification_results` c, \n"+
                "      `species` as s , \n"+
                "      `songtypes` as st \n"+
                "WHERE c.`job_id` = 1\n"+
                "AND c.`species_id` = s.`species_id` \n"+
                "AND c.`songtype_id` = st.`songtype_id` \n"+
                "AND jpc.`job_id` = c.`job_id` \n"+
                "AND mm.`model_id` = jpc.`model_id`"
            ]={value:[{count:1}]};
            projects.classificationDetail('/project_1/', 1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:1}]);
                done();
            });
        });
    });
    describe('classificationDetailMore', function(){
         
        it('Should return more details about a classification given its id.', function(done){
            dbpool.pool.cache[
                "SELECT cs.`json_stats`, \n"+
                "       c.`species_id`, \n"+
                "       c.`songtype_id`, \n"+
                "       c.`present` as present, \n"+
                "       c.`recording_id`, \n"+
                "       SUBSTRING_INDEX( \n"+
                "           SUBSTRING_INDEX( r.`uri` , '.', 1 ), \n"+
                "           '/', \n"+
                "           -1  \n"+
                "        ) as recname, \n"+
                "       CONCAT( \n"+
                "           SUBSTRING_INDEX( r.`uri` , '.', 1 ), \n"+
                "           '.thumbnail.png' \n"+
                "       ) as uri, \n"+
                "       CONCAT( \n"+
                "           UCASE(LEFT(st.`songtype`, 1)), \n"+
                "           SUBSTRING(st.`songtype`, 2) \n"+
                "        ) as songtype , \n"+
                "       CONCAT( \n"+
                "           UCASE(LEFT(s.`scientific_name`, 1)), \n"+
                "           SUBSTRING(s.`scientific_name`, 2) \n"+
                "       ) as scientific_name \n"+
                "FROM `classification_stats`  cs , \n"+
                "     `recordings` r, \n"+
                "     `classification_results` c, \n"+
                "     `species` as s , \n"+
                "     `songtypes` as st \n"+
                "WHERE c.`job_id` = 1\n"+
                "AND c.`job_id` = cs.`job_id` \n"+
                "AND c.`species_id` = s.`species_id` \n"+
                "AND c.`songtype_id` = st.`songtype_id` \n"+
                "AND r.`recording_id` = c.`recording_id` \n"+
                "ORDER BY present DESC LIMIT 0,10"
            ]={value:[{count:1}]};
            projects.classificationDetailMore('/project_1/', 1, '0', '10', function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:1}]);
                done();
            });
        });
    });
    describe('trainingSets', function(){
         
        it('Should return the training set data associated to a project given its url.', function(done){
            dbpool.pool.cache[
                "SELECT (select count(x1) from  `training_set_roi_set_data` tsrsd where tsrsd.`training_set_id` = ts.`training_set_id`) as count , ts.`training_set_id` , CONCAT(UCASE(LEFT(ts.`name`, 1)), SUBSTRING(ts.`name`, 2)) as name  , ts.`date_created` , CONCAT(UCASE(LEFT(st.`songtype`, 1)), SUBSTRING(st.`songtype`, 2)) as songtype  , CONCAT(UCASE(LEFT(s.`scientific_name`, 1)), SUBSTRING(s.`scientific_name`, 2)) as scientific_name  , tsrs.`species_id` , tsrs.`songtype_id`  FROM `training_sets` ts, `projects` p ,`training_sets_roi_set` tsrs , `songtypes` st , `species` s where ts.`training_set_id` = tsrs.`training_set_id` and  st.`songtype_id` = tsrs.`songtype_id` and s.`species_id`  = tsrs.`species_id`  and ts.`project_id` = p.`project_id` and p.`url` = '/project_1/'"
            ]={value:[{count:1}]};
            projects.trainingSets('/project_1/', function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:1}]);
                done();
            });
        });
    });
    describe('validationSets', function(){
         
        it('Should return the validation set info associated to a project given its url.', function(done){
            dbpool.pool.cache[
                "SELECT `validation_set_id` , ts.`name`  FROM `validation_set` ts, `projects` p  where ts.`project_id` = p.`project_id` and p.`url` = '/project_1/'"
            ]={value:[{count:1}]};
            projects.validationSets('/project_1/', function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:1}]);
                done();
            });
        });
    });
    describe('validationsStats', function(){
         
        it('Should return the validation stats of a given (species, songtype) pair class in a project given its url.', function(done){
            dbpool.pool.cache[
                "select * from  (SELECT count(*) as total FROM `recording_validations` rv,`projects` p  WHERE rv.`project_id` = p.`project_id` and p.`url` = '/project_1/' and `species_id` = 1 and `songtype_id` = 2 ) a,  (SELECT count(*) as present FROM `recording_validations` rv,`projects` p  WHERE rv.`project_id` = p.`project_id` and p.`url` = '/project_1/' and `species_id` = 1 and `songtype_id` = 2  and present = 1) b ,  (SELECT count(*) as absent FROM `recording_validations` rv,`projects` p  WHERE rv.`project_id` = p.`project_id` and p.`url` = '/project_1/' and `species_id` = 1and `songtype_id` = 2  and present = 0) c "
            ]={value:[{count:1}]};
            projects.validationsStats('/project_1/', 1, 2, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:1}]);
                done();
            });
        });
    });
    describe('validationsCount', function(){
         
        it('Should return the validation count of a project given its url.', function(done){
            dbpool.pool.cache[
                "SELECT count(*) AS count \n" +
                "FROM recording_validations AS rv\n" +
                "WHERE rv.project_id = 1"
            ]={value:[{count:1}]};
            projects.validationsCount(1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:1}]);
                done();
            });
        });
    });
    describe('modelValidationUri', function(){
         
        it('Should return validation uri of a model given its id.', function(done){
            dbpool.pool.cache[
                "SELECT vs.`uri` FROM `validation_set` vs, `models` m  WHERE m.`validation_set_id` = vs.`validation_set_id`  and m.`model_id` = 1"
            ]={value:[{count:1}]};
            projects.modelValidationUri(1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:1}]);
                done();
            });
        });
    });
    describe('removeUser', function(){
         
        it('Should remove a user from a project.', function(done){
            dbpool.pool.cache[
                "DELETE FROM user_project_role \nWHERE user_id = 9393 AND project_id = 1"
            ]={value:{affectedRows:1}};
            projects.removeUser(9393, 1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({affectedRows:1});
                done();
            });
        });
        it('Should fail if project_id is not a number.', function(done){
            projects.removeUser(9393, 'a1', function(err, results){
                should.exist(err);
                done();
            });
        });
        it('Should fail if user_id is not a number.', function(done){
            projects.removeUser('u9393', 1, function(err, results){
                should.exist(err);
                done();
            });
        });
    });
    describe('availableRoles', function(){
         
        it('Should return the available roles in the system.', function(done){
            dbpool.pool.cache[
                "SELECT role_id as id, name, description \n" +
                "FROM roles \n" +
                "WHERE name != 'Owner' order by level"
            ]={value:[{count:1}]};
            projects.availableRoles(function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:1}]);
                done();
            });
        });
    });
    describe('totalRecordings', function(){
         
        it('Should return the total ammount of recordings in a project given its id.', function(done){
            dbpool.pool.cache[
                "SELECT count(*) as count \n" +
                "FROM ( \n" +
                "        (SELECT upload_id as id \n" +
                "        FROM uploads_processing  \n" +
                "        WHERE project_id = 1) \n" +
                "        UNION \n" +
                "        (SELECT recording_id as id \n" +
                "        FROM recordings AS r \n" +
                "        JOIN sites AS s ON s.site_id = r.site_id \n" +
                "        WHERE s.project_id = 1) \n" +
                "    ) as t"
            ]={value:[{count:1}]};
            projects.totalRecordings(1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:1}]);
                done();
            });
        });
    });
});
