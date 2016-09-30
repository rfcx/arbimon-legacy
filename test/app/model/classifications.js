/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";

var chai = require('chai'), should = chai.should(), expect = chai.expect;
var async = require('async');
var sinon = require('sinon');
var mock_mysql = require('../../mock_tools/mock_mysql');
var mock_aws = require('../../mock_tools/mock_aws');

var rewire = require('rewire');

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

var dbpool = rewire('../../../app/utils/dbpool');
dbpool.__set__({
    config : function (key){ return mock_config[key]; },
    mysql  : mock_mysql,
});
dbpool.pool = mock_mysql.createPool();
// mock_mysql.pool.json_errors = true;
var classifications = rewire('../../../app/model/classifications');
classifications.__set__({
    config : function (key){ return mock_config[key]; },
    dbpool : dbpool,
    queryHandler : dbpool.queryHandler,
});

var mock_debug=function(){
    if(mock_debug.__spy__){
        mock_debug.__spy__.apply(mock_debug.__spy__, Array.prototype.slice.call(arguments));
    }
};

var debug=console.log;
classifications.__set__({
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
// var insertproject = {
//     url: 'project-url',
//     name: 'project',
//     description: 'description',
//     owner_id: 9393,
//     project_type_id: 1,
//     is_private: 1
// };
var news = {
    user_id: 9393,
    project_id: 1,
    data: 'news #5',
    news_type_id: 1
};

describe('Classifications', function(){
    
    beforeEach(function(){
        mock_mysql.pool.cache = {};
    });
    
    describe('list()', function(){
         
        it('Should return a list of classifications in a project given its id.', function(done){
            dbpool.pool.cache[
                "SELECT UNIX_TIMESTAMP( J.`date_created` )*1000  as `date`, J.`job_id`, JPC.name as cname, U.login as muser, PL.`name` as playlist_name," + 
                " PL.`playlist_id`, M.name as modname, M.`threshold`, M.model_id\n" + 
                "FROM `jobs` AS J\n" + 
                "JOIN `job_params_classification` AS JPC ON J.`job_id` = JPC.`job_id`\n" + 
                "JOIN `users` AS U ON U.`user_id` = J.`user_id`\n" + 
                "JOIN `playlists` AS PL ON PL.`playlist_id` = JPC.`playlist_id`\n" + 
                "JOIN `models` AS M ON M.`model_id` = JPC.`model_id`\n" + 
                "WHERE (J.`job_type_id` = 2)\n" + 
                " AND (J.`completed` = true)\n" + 
                " AND (J.`project_id` = 90732)\n" + 
                "\n" + 
                ";"
            ]={value:['c1', 'c2']};
            classifications.list(90732, function(err, results){
                should.not.exist(err);
                results.should.deep.equal(['c1', 'c2']);
                done();
            });
        });
    });
    describe('getName()', function(){
         
        it('Should return the name and project of a classification given its id.', function(done){
            dbpool.pool.cache[
                "SELECT REPLACE(lower(c.`name`),' ','_') as name, \n" + 
                "   j.`project_id` as pid \n" + 
                "FROM `job_params_classification`  c, \n" + 
                "   `jobs` j \n" + 
                "WHERE c.`job_id` = j.`job_id` \n" + 
                "AND c.`job_id` = 1"
            ]={value:[{name:'cl1', project_id:1}]};
            classifications.getName(1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{name:'cl1', project_id:1}]);
                done();
            });
        });
    });
    
    describe('delete()', function(){
        var queries;
        
        
        beforeEach(function(){
            queries = {
                getModelUri: "SELECT `uri` FROM `models` WHERE `model_id` = "+
                    "(SELECT `model_id` FROM `job_params_classification` WHERE `job_id` = 1)",
                getRecs: "SELECT `uri` FROM `recordings` WHERE `recording_id` in "+
                    "(SELECT `recording_id` FROM `classification_results` WHERE `job_id` = 1)",
                deleteResults: "DELETE FROM `classification_results` WHERE `job_id` = 1",
                deleteStats: "DELETE FROM `classification_stats` WHERE `job_id` = 1",
                deleteClassiParams: "DELETE FROM `job_params_classification` WHERE `job_id` = 1"
            };
            mock_mysql.pool.cache = {};
            delete mock_aws.S3.buckets.kfc_bucket;
        });
        
        it('Should remove a classification given its id.', function(done){
            dbpool.pool.cache[queries.getModelUri] = {
                value:[{ uri:'project_1/models/model_1.mod' }]
            };
            
            dbpool.pool.cache[queries.getRecs] = { value:[] };
            
            dbpool.pool.cache[queries.deleteResults] = {
                value:{affectedRows:1}
            };
            
            dbpool.pool.cache[queries.deleteStats] = {
                value:{affectedRows:1}
            };
            
            dbpool.pool.cache[queries.deleteClassiParams] = {
                value:{affectedRows:1}
            };
            
            classifications.delete(1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({data:"Classification deleted succesfully"});
                done();
            });
        });
        
        it('Should fail if model query fails', function(done){
            classifications.delete(1, function(err, results){
                should.exist(err);
                done();
            });
        });
        
        it('Should fail if recordings query fails', function(done){
            dbpool.pool.cache[queries.getModelUri]={
                value:[{uri:'project_1/models/model_1.mod'}]
            };
            
            classifications.delete(1, function(err, results){
                should.exist(err);
                done();
            });
        });
        
        it('Should fail if delete classification_results query fails', function(done){
            dbpool.pool.cache[queries.getModelUri]={
                value:[{uri:'project_1/models/model_1.mod'}]
            };
            
            dbpool.pool.cache[queries.getRecs] = { value:[] };
            
            classifications.delete(1, function(err, results){
                should.exist(err);
                done();
            });
        });
        
        it('Should fail if delete classification_stats query fails', function(done){
            dbpool.pool.cache[queries.getModelUri]={
                value:[{uri:'project_1/models/model_1.mod'}]
            };
            
            dbpool.pool.cache[queries.getRecs] = { value:[] };
            
            dbpool.pool.cache[queries.deleteResults] = {
                value:{affectedRows:1}
            };
            
            classifications.delete(1, function(err, results){
                should.exist(err);
                done();
            });
        });
        
        it('Should fail if delete job_params_classification query fails', function(done){
            dbpool.pool.cache[queries.getModelUri] = {
                value:[{ uri:'project_1/models/model_1.mod' }]
            };
            
            dbpool.pool.cache[queries.getRecs] = { value:[] };
            
            dbpool.pool.cache[queries.deleteResults] = {
                value:{affectedRows:1}
            };
            
            dbpool.pool.cache[queries.deleteStats] = {
                value:{affectedRows:1}
            };
            
            classifications.delete(1, function(err, results){
                should.exist(err);
                done();
            });
        });
        
        it('Should remove the vector files from any associated recordings.', function(done){
            mock_aws.S3.buckets.kfc_bucket = {
                'project_1/models/model_1/classification_1_site_1-1-1-1-1-1.wav.vector' : {}
            };
            
            dbpool.pool.cache[queries.getModelUri] = {
                value:[{ uri:'project_1/models/model_1.mod' }]
            };
            
            dbpool.pool.cache[queries.getRecs] = { 
                value:[{uri:'project_1/recordings/site_1/site_1-1-1-1-1-1.wav'}]
            };
            
            dbpool.pool.cache[queries.deleteResults] = {
                value:{affectedRows:1}
            };
            
            dbpool.pool.cache[queries.deleteStats] = {
                value:{affectedRows:1}
            };
            
            dbpool.pool.cache[queries.deleteClassiParams] = {
                value:{affectedRows:1}
            };
            
            classifications.delete(1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({data:'Classification deleted succesfully'});
                done();
            });
        });
        
        it('Should fail if bucket operations fail', function(done){
            dbpool.pool.cache[queries.getModelUri] = {
                value:[{ uri:'project_1/models/model_1.mod' }]
            };
            
            dbpool.pool.cache[queries.getRecs] = { 
                value:[{uri:'project_1/recordings/site_1/site_1-1-1-1-1-1.wav'}]
            };
            
            classifications.delete(1, function(err, results){
                should.exist(err);
                done();
            });
        });
    });
    describe('getCsvData()', function(){
         
        it('Should return the results of a classification given its id.', function(done){
            dbpool.pool.cache[
                "SELECT extract(year from r.`datetime`) year, \n" + 
                "   extract(month from r.`datetime`) month, \n" + 
                "   extract(day from r.`datetime`) day, \n" + 
                "   extract(hour from r.`datetime`) hour, \n" + 
                "   extract(minute from r.`datetime`) min,  \n" + 
                "   m.`threshold`, \n" + 
                "   m.`uri`, \n" + 
                "   r.`uri` as ruri, \n" + 
                "   cr.`max_vector_value` as mvv, \n" + 
                "   SUBSTRING_INDEX(r.`uri` ,'/',-1 ) rec, \n" + 
                "   cr.`present`, \n" + 
                "   s.`name`, \n" + 
                "   sp.`scientific_name`, \n" + 
                "   st.`songtype` \n" + 
                "FROM `models` m , \n" + 
                "   `job_params_classification`  jpc, \n" + 
                "   `species` sp, \n" + 
                "   `classification_results` cr, \n" + 
                "   `recordings` r, \n" + 
                "   `sites` s, \n" + 
                "   `songtypes` st \n" + 
                "WHERE cr.`job_id` = 1 \n" + 
                "AND jpc.`job_id` = cr.`job_id` \n" + 
                "AND jpc.`model_id` = m.`model_id` \n" + 
                "AND cr.`recording_id` = r.`recording_id` \n" + 
                "AND s.`site_id` = r.`site_id` \n" + 
                "AND sp.`species_id` = cr.`species_id` \n" + 
                "AND cr.`songtype_id` = st.`songtype_id` "
            ]={value:['c1', 'c2']};
            classifications.getCsvData(1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal(['c1', 'c2']);
                done();
            });
        });
    });
    describe('errorsCount()', function(){
         
        it('Should return the errors of a classification given its id.', function(done){
            
            dbpool.pool.cache[
                "SELECT count(*) AS count \nFROM recordings_errors \nWHERE job_id = 1"
            ]={value:[{count:1}]};
            
            classifications.errorsCount(1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:1}]);
                done();
            });
        });
    });
    describe('detail()', function(){
         
        it('Should return the details of a classification given its id.', function(done){
            dbpool.pool.cache[
                "SELECT c.`species_id`, \n" + 
                "   c.`songtype_id`, \n" + 
                "   SUM(c.`present`) as present, \n" + 
                "   COUNT(c.`present`) as total, \n" + 
                "   CONCAT( \n" + 
                "       UCASE(LEFT(st.`songtype`, 1)),  \n" + 
                "       SUBSTRING(st.`songtype`, 2)  \n" + 
                "   ) as songtype,  \n" + 
                "   CONCAT( \n" + 
                "       UCASE(LEFT(s.`scientific_name`, 1)),  \n" + 
                "       SUBSTRING(s.`scientific_name`, 2)  \n" + 
                "   ) as scientific_name, \n" + 
                "   m.`threshold` as th \n" + 
                "FROM `classification_results` as c \n" + 
                "JOIN `job_params_classification` as jpc ON jpc.`job_id` = c.`job_id` \n" + 
                "JOIN `models` m  ON m.`model_id` = jpc.`model_id` \n" + 
                "JOIN `species` as s ON c.`species_id` = s.`species_id` \n" + 
                "JOIN `songtypes` as st ON c.`songtype_id` = st.`songtype_id` \n" + 
                "WHERE c.`job_id` = 1 \n" + 
                "GROUP BY c.`species_id`, c.`songtype_id`"
            ]={value:[{count:1}]};
            classifications.detail(1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:1}]);
                done();
            });
        });
    });
    describe('moreDetails()', function(){
         
        it('Should return more details about a classification given its id.', function(done){
            dbpool.pool.cache[
                "SELECT cs.`json_stats`, \n" + 
                "       c.`species_id`, \n" + 
                "       c.`songtype_id`, \n" + 
                "       c.`present` as present, \n" + 
                "       c.`recording_id`, \n" + 
                "       r.`uri`, \n" + 
                "       SUBSTRING_INDEX( \n" + 
                "           SUBSTRING_INDEX( r.`uri` , '.', 1 ), \n" + 
                "           '/', \n" + 
                "           -1  \n" + 
                "        ) as recname, \n" + 
                "       CONCAT( \n" + 
                "           UCASE(LEFT(st.`songtype`, 1)), \n" + 
                "           SUBSTRING(st.`songtype`, 2) \n" + 
                "        ) as songtype , \n" + 
                "       CONCAT( \n" + 
                "           UCASE(LEFT(s.`scientific_name`, 1)), \n" + 
                "           SUBSTRING(s.`scientific_name`, 2) \n" + 
                "       ) as scientific_name \n" + 
                "FROM `classification_stats`  cs , \n" + 
                "     `recordings` r, \n" + 
                "     `classification_results` c, \n" + 
                "     `species` as s , \n" + 
                "     `songtypes` as st \n" + 
                "WHERE c.`job_id` = 1 \n" + 
                "AND c.`job_id` = cs.`job_id` \n" + 
                "AND c.`species_id` = s.`species_id` \n" + 
                "AND c.`songtype_id` = st.`songtype_id` \n" + 
                "AND r.`recording_id` = c.`recording_id` \n" + 
                "ORDER BY present DESC LIMIT 0,10"
            ]={value:[{count:1}]};
            classifications.moreDetails(1, '0', '10', function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:1}]);
                done();
            });
        });
    });
});
