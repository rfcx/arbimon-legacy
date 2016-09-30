/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";

var chai = require('chai'), should = chai.should(), expect = chai.expect;
var sinon = require('sinon');
var q = require('q');
var mock_mysql = require('../../mock_tools/mock_mysql');
var rewire = require('rewire');

var dbpool = rewire('../../../app/utils/dbpool');
dbpool.__set__({mysql : mock_mysql});
dbpool.pool = mock_mysql.createPool(true);
var jobs = rewire('../../../app/model/jobs');
jobs.__set__({
    dbpool :  dbpool,
    queryHandler: dbpool.queryHandler,
});
var jobsJoi = jobs.__get__('joi');

var TEST_JOB_TYPES = {
    empty_jt:{type_id:-1001},
    no_report_jt:{type_id:-1002, sql:{}},
    basic_jt:{type_id:-1003, sql:{
        report:{
            projections : ['BJT_P.name_field as name'],
            tables      : ['JOIN `basic_jt_params` as BJT_P ON J.job_id = BJT_P.job_id'],
        }
    }},
};

describe('model.Jobs', function(){
    describe('job_types', function(){
        describe('training_job', function(){
            describe('new()', function(){
                it('should insert the training job parameters to the database', function(done){
                    var db = new mock_mysql.types.connection();
                    db.cache[
                        "INSERT INTO `job_params_training` (`job_id`, `model_type_id`, \n" +
                        " `training_set_id`, `validation_set_id`, `trained_model_id`, \n" +
                        " `use_in_training_present`,`use_in_training_notpresent`,`use_in_validation_present`,`use_in_validation_notpresent` ,`name` \n" +
                        ") VALUES ( \n" +
                        "-1, -2, -3, NULL, NULL, -4, -5, -6, -7, 'name'\n" +
                        ")"
                    ]={value:{insertId:-20202}};
                    jobs.job_types.training_job.new({
                        job_id : -1,
                        classifier : -2,
                        train : -3,
                        upt : -4,
                        unt : -5,
                        upv : -6,
                        unv : -7,
                        name : 'name',
                    }, db).then(function(results){
                        results[0].should.deep.equal({insertId:-20202});
                    }).then(done, done);
                });
            });
        });
        describe('classification_job', function(){
            describe('new()', function(){
                it('should insert the classification job parameters to the database', function(done){
                    var db = new mock_mysql.types.connection();
                    db.cache[
                        "INSERT INTO `job_params_classification` (\n" +
                        "   `job_id`, `model_id`, `playlist_id` ,`name` \n" +
                        ") VALUES ( \n" + 
                        "   -1, -2, -3, 'name'\n" +
                        ")"
                    ]={value:{insertId:-20202}};
                    jobs.job_types.classification_job.new({
                        job_id : -1,
                        classifier : -2,
                        playlist : -3,
                        name : 'name',
                    }, db).then(function(results){
                        results[0].should.deep.equal({insertId:-20202});
                    }).then(done, done);
                });
            });
        });
        describe('soundscape_job', function(){
            describe('new()', function(){
                it('should insert the soundscape_job parameters to the database', function(done){
                    var db = new mock_mysql.types.connection();
                    db.cache[
                        "INSERT INTO `job_params_soundscape`( \n"+
                        "   `job_id`, `playlist_id`, `max_hertz`, `bin_size`, `soundscape_aggregation_type_id`, `name`, `threshold` , `threshold_type` , `frequency` , `normalize` \n" +
                        ") VALUES ( \n" + 
                        "    -1, -2, 87, 3000, \n"+
                        "    (SELECT `soundscape_aggregation_type_id` FROM `soundscape_aggregation_types` WHERE `identifier` = 'arpeggio'), \n" +
                        "    'name', -10, 'constant', 1245, 'meh...' \n" +
                        ")"
                    ]={value:{insertId:-20202}};
                    jobs.job_types.soundscape_job.new({
                        job_id: -1,
                        playlist: -2,
                        maxhertz: 87,
                        bin: 3000,
                        aggregation: 'arpeggio',
                        name: 'name',
                        threshold: -10,
                        threshold_type: 'constant',
                        frequency: 1245,
                        normalize: 'meh...',
                    }, db).then(function(results){
                        results[0].should.deep.equal({insertId:-20202});
                    }).then(done, done);
                });
            });
        });
        describe('audio_event_detection_job', function(){
            describe('new()', function(){
                it('should insert the audio_event_detection_job parameters to the database', function(done){
                    var db = new mock_mysql.types.connection();
                    db.cache[
                        "INSERT INTO `job_params_audio_event_detection`( \n"+
                        "   `job_id`, `name`, `playlist_id`, `configuration_id`, `statistics`\n" +
                        ") VALUES (?, ?, ?, ?, ?)"
                    ]={value:{insertId:-20202}};
                    jobs.job_types.audio_event_detection_job.new({
                        job_id : -1, 
                        name : 'name', 
                        playlist : -2, 
                        configuration : -3, 
                    }, db).then(function(results){
                        results[0].should.deep.equal({insertId:-20202});
                    }).then(done, done);
                });
            });
        });
    });
    
    describe('newJob', function(){
        var original_job_types;
        beforeEach(function(){
                mock_mysql.pool.cache = {};
                original_job_types = jobs.job_types;
                jobs.job_types = TEST_JOB_TYPES;
                jobs.job_types.basic_jt.new = sinon.stub();
                sinon.stub(jobsJoi, 'validate');
                jobsJoi.validate.yields();
        });
        afterEach(function(){
            delete jobs.job_types.basic_jt.new;
            jobs.job_types = original_job_types;
            jobsJoi.validate.restore();
        });
        it('should create a new job and return its id', function(done){
            dbpool.pool.cache.BEGIN={no_value:true};
            dbpool.pool.cache.COMMIT={no_value:true};
            dbpool.pool.cache[
                "SELECT enabled FROM job_types WHERE job_type_id = ?"
            ]={value:[{enabled:1}]};
            dbpool.pool.cache[
                "INSERT INTO `jobs` ( \n" +
                "   `job_type_id`, `date_created`, `last_update`, `project_id`, `user_id`, `uri`, `remarks` \n" +
                ") VALUES (?, now(), now(), ?, ?,'',''" +
                ")"
            ]={value:{insertId:-10101}};
            
            jobs.job_types.basic_jt.new.returns(q.resolve());

            jobs.newJob({}, 'basic_jt', function(err, results){
                should.not.exist(err);
                dbpool.pool.__connections__.length.should.equal(0);
                results.should.equal(-10101);
                done();
            });
        });
        it('should err if job type is not supported', function(done){
            jobs.newJob({}, 'unsupported_jt', function(err, results){
                should.exist(err);
                err.message.should.equal("Invalid job type unsupported_jt.");
                done();
            });
        });
        it('should err if job type is not in the database', function(done){
            dbpool.pool.cache[
                "SELECT enabled FROM job_types WHERE job_type_id = ?"
            ]={value:[]};
            jobs.newJob({}, 'basic_jt', function(err, results){
                should.exist(err);
                err.message.should.equal("Job type not found on DB");
                done();
            });
        });
        it('should err if job type is not enabled', function(done){
            dbpool.pool.cache[
                "SELECT enabled FROM job_types WHERE job_type_id = ?"
            ]={value:[{enabled:0}]};
            jobs.newJob({}, 'basic_jt', function(err, results){
                should.exist(err);
                err.message.should.equal("Job type not enabled");
                done();
            });
        });
        it('should err validate the params against the job type schema if it has one', function(done){
            jobs.job_types.basic_jt.schema={a:1,b:2,c:3};
                    
            dbpool.pool.cache.BEGIN={no_value:true};
            dbpool.pool.cache.COMMIT={no_value:true};
            dbpool.pool.cache[
                "SELECT enabled FROM job_types WHERE job_type_id = ?"
            ]={value:[{enabled:1}]};
            dbpool.pool.cache[
                "INSERT INTO `jobs` ( \n" +
                "   `job_type_id`, `date_created`, `last_update`, `project_id`, `user_id`, `uri`, `remarks` \n" +
                ") VALUES (?, now(), now(), ?, ?,'',''" +
                ")"
            ]={value:{insertId:-10101}};
            
            jobs.job_types.basic_jt.new.returns(q.resolve());

            jobs.newJob({}, 'basic_jt', function(err, results){
                delete jobs.job_types.basic_jt.schema;
                should.not.exist(err);
                dbpool.pool.__connections__.length.should.equal(0);
                jobsJoi.validate.callCount.should.equal(1);
                results.should.equal(-10101);
                done();
            });
        });
    });
    
    describe('getJobTypes()', function(){
        beforeEach(function(){
            mock_mysql.pool.cache = {};
        });
        it('should callback with the job types in the database', function(done){
            var jobtype = {id:-10, name:'test job type', description:'!!!!', enabled:1};
            dbpool.pool.cache[
                "SELECT job_type_id as id, name, description, enabled \n"+
                "FROM job_types"
            ]={value:[jobtype]};
            
            jobs.getJobTypes(function(err, results){
                should.not.exist(err);
                results.should.deep.equal([jobtype]);
                done();
            });
        });
    });
    describe('hide()', function(){
        beforeEach(function(){
            mock_mysql.pool.cache = {};
        });
        it('should set the `hide` flag on the given job id', function(done){
            dbpool.pool.cache[
                "update `jobs` set `hidden`  = 1 where `job_id` = ?"
            ]={value:{affectedRows:1}};
            
            jobs.hide(1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({affectedRows:1});
                done();
            });
        });
    });
    describe('cancel()', function(){
        beforeEach(function(){
            mock_mysql.pool.cache = {};
        });
        it('should set the `cancel_requested` flag on the given job id', function(done){
            dbpool.pool.cache[
                "update `jobs` set `cancel_requested`  = 1 where `job_id` = ?"
            ]={value:{affectedRows:1}};
            
            jobs.cancel(1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({affectedRows:1});
                done();
            });
        });
    });
    describe('classificationNameExists()', function(){
        beforeEach(function(){
            mock_mysql.pool.cache = {};
        });
        it('should query the database for the given name on the given project', function(done){
            dbpool.pool.cache[
                "SELECT count(*) as count FROM `jobs` J ,  `job_params_classification` JPC " +
                "WHERE `project_id` = ?\n" +
                "  AND `job_type_id` = 2\n" +
                "  AND J.`job_id` = JPC.`job_id`\n" +
                "  AND `name` like ? "
            ]={value:[{count:-111}]};
            
            jobs.classificationNameExists({pid:1, name:'vaca'}, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:-111}]);
                done();
            });
        });
    });
    describe('modelNameExists()', function(){
        beforeEach(function(){
            mock_mysql.pool.cache = {};
        });
        it('should query the database for the given name on the given project', function(done){
            dbpool.pool.cache[
                "SELECT count(*) as count FROM `jobs` J ,  `job_params_training` JPC " +
                " WHERE `project_id` = ? and `job_type_id` = 1 and J.`job_id` = JPC.`job_id` " +
                " and `name` like ? "
            ]={value:[{count:-111}]};
            
            jobs.modelNameExists({pid:1, name:'vaca'}, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:-111}]);
                done();
            });
        });
    });
    describe('soundscapeNameExists()', function(){
        beforeEach(function(){
            mock_mysql.pool.cache = {};
        });
        it('should query the database for the given name on the given project', function(done){
            dbpool.pool.cache[
                "SELECT count(*) as count FROM `soundscapes` WHERE `project_id` = ? and `name` LIKE ?"
            ]={value:[{count:-111}]};
            
            jobs.soundscapeNameExists({pid:1, name:'vaca'}, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:-111}]);
                done();
            });
        });
    });
    describe('activeJobs()', function(){
        var original_job_types;
        beforeEach(function(){
            mock_mysql.pool.cache = {};
            original_job_types = jobs.job_types;
            jobs.job_types = TEST_JOB_TYPES;
        });
        afterEach(function(){
            jobs.job_types = original_job_types;
        });
        it('should query the database for currently active jobs', function(done){
            dbpool.pool.cache[
                "(\n" +
                "SELECT J.`progress`, J.`progress_steps`, J.`job_type_id`, JT.name as type, J.`job_id`, J.state, J.last_update,\n" +
                "    round(100*(J.`progress`/J.`progress_steps`),1) as percentage\n" +
                "FROM `jobs` as J \n" +
                "    JOIN job_types JT ON J.job_type_id = JT.job_type_id\n" +
                "WHERE J.`hidden` = 0\n" +
                "  AND J.job_type_id = -1001\n" +
                ") UNION (\n" +
                "SELECT J.`progress`, J.`progress_steps`, J.`job_type_id`, JT.name as type, J.`job_id`, J.state, J.last_update,\n" +
                "    round(100*(J.`progress`/J.`progress_steps`),1) as percentage\n" +
                "FROM `jobs` as J \n" +
                "    JOIN job_types JT ON J.job_type_id = JT.job_type_id\n" +
                "WHERE J.`hidden` = 0\n" +
                "  AND J.job_type_id = -1002\n" +
                ") UNION (\n" +
                "SELECT J.`progress`, J.`progress_steps`, J.`job_type_id`, JT.name as type, J.`job_id`, J.state, J.last_update,\n" +
                "    BJT_P.name_field as name,\n" +
                "    round(100*(J.`progress`/J.`progress_steps`),1) as percentage\n" +
                "FROM `jobs` as J \n" +
                "    JOIN `basic_jt_params` as BJT_P ON J.job_id = BJT_P.job_id\n" +
                "    JOIN job_types JT ON J.job_type_id = JT.job_type_id\n" +
                "WHERE J.`hidden` = 0\n" +
                "  AND J.job_type_id = -1003\n" +
                ")"
            ]={value:['blah blah']};
            
            jobs.activeJobs(function(err, results){
                should.not.exist(err);
                results.should.deep.equal(['blah blah']);
                done();
            });
        });
        it('if given project object has no id or url, it gets ignored', function(done){
            dbpool.pool.cache[
                "(\n" +
                "SELECT J.`progress`, J.`progress_steps`, J.`job_type_id`, JT.name as type, J.`job_id`, J.state, J.last_update,\n" +
                "    round(100*(J.`progress`/J.`progress_steps`),1) as percentage\n" +
                "FROM `jobs` as J \n" +
                "    JOIN job_types JT ON J.job_type_id = JT.job_type_id\n" +
                "WHERE J.`hidden` = 0\n" +
                "  AND J.job_type_id = -1001\n" +
                ") UNION (\n" +
                "SELECT J.`progress`, J.`progress_steps`, J.`job_type_id`, JT.name as type, J.`job_id`, J.state, J.last_update,\n" +
                "    round(100*(J.`progress`/J.`progress_steps`),1) as percentage\n" +
                "FROM `jobs` as J \n" +
                "    JOIN job_types JT ON J.job_type_id = JT.job_type_id\n" +
                "WHERE J.`hidden` = 0\n" +
                "  AND J.job_type_id = -1002\n" +
                ") UNION (\n" +
                "SELECT J.`progress`, J.`progress_steps`, J.`job_type_id`, JT.name as type, J.`job_id`, J.state, J.last_update,\n" +
                "    BJT_P.name_field as name,\n" +
                "    round(100*(J.`progress`/J.`progress_steps`),1) as percentage\n" +
                "FROM `jobs` as J \n" +
                "    JOIN `basic_jt_params` as BJT_P ON J.job_id = BJT_P.job_id\n" +
                "    JOIN job_types JT ON J.job_type_id = JT.job_type_id\n" +
                "WHERE J.`hidden` = 0\n" +
                "  AND J.job_type_id = -1003\n" +
                ")"
            ]={value:['blah blah']};
            
            jobs.activeJobs({etwas:1}, function(err, results){
                should.not.exist(err);
                results.should.deep.equal(['blah blah']);
                done();
            });
        });
        it('should filter for a given project id', function(done){
            dbpool.pool.cache[                                              
                "(\n" +
                "SELECT J.`progress`, J.`progress_steps`, J.`job_type_id`, JT.name as type, J.`job_id`, J.state, J.last_update,\n" +
                "    round(100*(J.`progress`/J.`progress_steps`),1) as percentage\n" +
                "FROM `jobs` as J \n" +
                "    JOIN job_types JT ON J.job_type_id = JT.job_type_id\n" +
                "WHERE J.`hidden` = 0 AND J.project_id = -1234001\n" +
                "  AND J.job_type_id = -1001\n" +
                ") UNION (\n" +
                "SELECT J.`progress`, J.`progress_steps`, J.`job_type_id`, JT.name as type, J.`job_id`, J.state, J.last_update,\n" +
                "    round(100*(J.`progress`/J.`progress_steps`),1) as percentage\n" +
                "FROM `jobs` as J \n" +
                "    JOIN job_types JT ON J.job_type_id = JT.job_type_id\n" +
                "WHERE J.`hidden` = 0 AND J.project_id = -1234001\n" +
                "  AND J.job_type_id = -1002\n" +
                ") UNION (\n" +
                "SELECT J.`progress`, J.`progress_steps`, J.`job_type_id`, JT.name as type, J.`job_id`, J.state, J.last_update,\n" +
                "    BJT_P.name_field as name,\n" +
                "    round(100*(J.`progress`/J.`progress_steps`),1) as percentage\n" +
                "FROM `jobs` as J \n" +
                "    JOIN `basic_jt_params` as BJT_P ON J.job_id = BJT_P.job_id\n" +
                "    JOIN job_types JT ON J.job_type_id = JT.job_type_id\n" +
                "WHERE J.`hidden` = 0 AND J.project_id = -1234001\n" +
                "  AND J.job_type_id = -1003\n" +
                ")"
            ]={value:['blah blah']};
            
            jobs.activeJobs({id:-1234001}, function(err, results){
                should.not.exist(err);
                results.should.deep.equal(['blah blah']);
                done();
            });
        });
        it('should filter for a given project id (as an integer)', function(done){
            dbpool.pool.cache[                                              
                "(\n" +
                "SELECT J.`progress`, J.`progress_steps`, J.`job_type_id`, JT.name as type, J.`job_id`, J.state, J.last_update,\n" +
                "    round(100*(J.`progress`/J.`progress_steps`),1) as percentage\n" +
                "FROM `jobs` as J \n" +
                "    JOIN job_types JT ON J.job_type_id = JT.job_type_id\n" +
                "WHERE J.`hidden` = 0 AND J.project_id = -1234001\n" +
                "  AND J.job_type_id = -1001\n" +
                ") UNION (\n" +
                "SELECT J.`progress`, J.`progress_steps`, J.`job_type_id`, JT.name as type, J.`job_id`, J.state, J.last_update,\n" +
                "    round(100*(J.`progress`/J.`progress_steps`),1) as percentage\n" +
                "FROM `jobs` as J \n" +
                "    JOIN job_types JT ON J.job_type_id = JT.job_type_id\n" +
                "WHERE J.`hidden` = 0 AND J.project_id = -1234001\n" +
                "  AND J.job_type_id = -1002\n" +
                ") UNION (\n" +
                "SELECT J.`progress`, J.`progress_steps`, J.`job_type_id`, JT.name as type, J.`job_id`, J.state, J.last_update,\n" +
                "    BJT_P.name_field as name,\n" +
                "    round(100*(J.`progress`/J.`progress_steps`),1) as percentage\n" +
                "FROM `jobs` as J \n" +
                "    JOIN `basic_jt_params` as BJT_P ON J.job_id = BJT_P.job_id\n" +
                "    JOIN job_types JT ON J.job_type_id = JT.job_type_id\n" +
                "WHERE J.`hidden` = 0 AND J.project_id = -1234001\n" +
                "  AND J.job_type_id = -1003\n" +
                ")"
            ]={value:['blah blah']};
            
            jobs.activeJobs(-1234001, function(err, results){
                should.not.exist(err);
                results.should.deep.equal(['blah blah']);
                done();
            });
        });
        it('should filter for a given project url', function(done){
            dbpool.pool.cache[                                              
                "(\n" +
                "SELECT J.`progress`, J.`progress_steps`, J.`job_type_id`, JT.name as type, J.`job_id`, J.state, J.last_update,\n" +
                "    round(100*(J.`progress`/J.`progress_steps`),1) as percentage\n" +
                "FROM `jobs` as J \n" +
                "    JOIN job_types JT ON J.job_type_id = JT.job_type_id\n" +
                "JOIN projects P ON J.project_id = P.project_id\n" +
                "WHERE J.`hidden` = 0 AND P.url = '*my_project*'\n" +
                "  AND J.job_type_id = -1001\n" +
                ") UNION (\n" +
                "SELECT J.`progress`, J.`progress_steps`, J.`job_type_id`, JT.name as type, J.`job_id`, J.state, J.last_update,\n" +
                "    round(100*(J.`progress`/J.`progress_steps`),1) as percentage\n" +
                "FROM `jobs` as J \n" +
                "    JOIN job_types JT ON J.job_type_id = JT.job_type_id\n" +
                "JOIN projects P ON J.project_id = P.project_id\n" +
                "WHERE J.`hidden` = 0 AND P.url = '*my_project*'\n" +
                "  AND J.job_type_id = -1002\n" +
                ") UNION (\n" +
                "SELECT J.`progress`, J.`progress_steps`, J.`job_type_id`, JT.name as type, J.`job_id`, J.state, J.last_update,\n" +
                "    BJT_P.name_field as name,\n" +
                "    round(100*(J.`progress`/J.`progress_steps`),1) as percentage\n" +
                "FROM `jobs` as J \n" +
                "    JOIN `basic_jt_params` as BJT_P ON J.job_id = BJT_P.job_id\n" +
                "    JOIN job_types JT ON J.job_type_id = JT.job_type_id\n" +
                "JOIN projects P ON J.project_id = P.project_id\n" +
                "WHERE J.`hidden` = 0 AND P.url = '*my_project*'\n" +
                "  AND J.job_type_id = -1003\n" +
                ")"
            ]={value:['blah blah']};
            
            jobs.activeJobs({url:'*my_project*'}, function(err, results){
                should.not.exist(err);
                results.should.deep.equal(['blah blah']);
                done();
            });
        });
    });
    describe('find()', function(){
        beforeEach(function(){
            mock_mysql.pool.cache = {};
        });
        it('should accept an empty query.', function(done){
            dbpool.pool.cache[
                "SELECT j.job_id, \n" +
                "       j.progress, \n" +
                "       j.progress_steps, \n" +
                "       j.state, \n" +
                "       j.completed, \n" +
                "       u.login as user, \n" +
                "       p.name as project, \n" +
                "       j.project_id, \n" +
                "       j.date_created AS created, \n" +
                "       j.last_update, \n" +
                "       jt.name as type, \n" +
                "       j.hidden, \n" +
                "       j.remarks, \n" +
                "       j.cancel_requested \n" +
                "FROM jobs AS j \n" +
                "JOIN users AS u ON j.user_id = u.user_id \n" +
                "JOIN projects AS p ON j.project_id = p.project_id \n" +
                "JOIN job_types AS jt ON j.job_type_id = jt.job_type_id \n" +
                "\n" +
                " ORDER BY j.job_id DESC \n" +
                "LIMIT 0, 100"
            ]={value:[{count:-111}]};
            
            jobs.find(function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:-111}]);
                done();
            });
        });
        describe('query.is', function(){
            it('\'visible\' should filter visible jobs.', function(done){
                dbpool.pool.cache[
                    "SELECT j.job_id, \n" +
                    "       j.progress, \n" +
                    "       j.progress_steps, \n" +
                    "       j.state, \n" +
                    "       j.completed, \n" +
                    "       u.login as user, \n" +
                    "       p.name as project, \n" +
                    "       j.project_id, \n" +
                    "       j.date_created AS created, \n" +
                    "       j.last_update, \n" +
                    "       jt.name as type, \n" +
                    "       j.hidden, \n" +
                    "       j.remarks, \n" +
                    "       j.cancel_requested \n" +
                    "FROM jobs AS j \n" +
                    "JOIN users AS u ON j.user_id = u.user_id \n" +
                    "JOIN projects AS p ON j.project_id = p.project_id \n" +
                    "JOIN job_types AS jt ON j.job_type_id = jt.job_type_id \n" +
                    "WHERE j.hidden = 0\n" +
                    " ORDER BY j.job_id DESC \n" +
                    "LIMIT 0, 100"
                ]={value:[{count:-111}]};
                
                jobs.find({is:'visible'}, function(err, results){
                    should.not.exist(err);
                    results.should.deep.equal([{count:-111}]);
                    done();
                });
            });
            it('\'hidden\' should filter hidden jobs.', function(done){
                dbpool.pool.cache[
                    "SELECT j.job_id, \n" +
                    "       j.progress, \n" +
                    "       j.progress_steps, \n" +
                    "       j.state, \n" +
                    "       j.completed, \n" +
                    "       u.login as user, \n" +
                    "       p.name as project, \n" +
                    "       j.project_id, \n" +
                    "       j.date_created AS created, \n" +
                    "       j.last_update, \n" +
                    "       jt.name as type, \n" +
                    "       j.hidden, \n" +
                    "       j.remarks, \n" +
                    "       j.cancel_requested \n" +
                    "FROM jobs AS j \n" +
                    "JOIN users AS u ON j.user_id = u.user_id \n" +
                    "JOIN projects AS p ON j.project_id = p.project_id \n" +
                    "JOIN job_types AS jt ON j.job_type_id = jt.job_type_id \n" +
                    "WHERE j.hidden = 1\n" +
                    " ORDER BY j.job_id DESC \n" +
                    "LIMIT 0, 100"
                ]={value:[{count:-111}]};
                
                jobs.find({is:'hidden'}, function(err, results){
                    should.not.exist(err);
                    results.should.deep.equal([{count:-111}]);
                    done();
                });
            });
            it('\'completed\' should filter completed jobs.', function(done){
                dbpool.pool.cache[
                    "SELECT j.job_id, \n" +
                    "       j.progress, \n" +
                    "       j.progress_steps, \n" +
                    "       j.state, \n" +
                    "       j.completed, \n" +
                    "       u.login as user, \n" +
                    "       p.name as project, \n" +
                    "       j.project_id, \n" +
                    "       j.date_created AS created, \n" +
                    "       j.last_update, \n" +
                    "       jt.name as type, \n" +
                    "       j.hidden, \n" +
                    "       j.remarks, \n" +
                    "       j.cancel_requested \n" +
                    "FROM jobs AS j \n" +
                    "JOIN users AS u ON j.user_id = u.user_id \n" +
                    "JOIN projects AS p ON j.project_id = p.project_id \n" +
                    "JOIN job_types AS jt ON j.job_type_id = jt.job_type_id \n" +
                    "WHERE j.completed = 1\n" +
                    " ORDER BY j.job_id DESC \n" +
                    "LIMIT 0, 100"
                ]={value:[{count:-111}]};
                
                jobs.find({is:'completed'}, function(err, results){
                    should.not.exist(err);
                    results.should.deep.equal([{count:-111}]);
                    done();
                });
            });
            it('[...] should filter any given combination.', function(done){
                dbpool.pool.cache[
                    "SELECT j.job_id, \n" +
                    "       j.progress, \n" +
                    "       j.progress_steps, \n" +
                    "       j.state, \n" +
                    "       j.completed, \n" +
                    "       u.login as user, \n" +
                    "       p.name as project, \n" +
                    "       j.project_id, \n" +
                    "       j.date_created AS created, \n" +
                    "       j.last_update, \n" +
                    "       jt.name as type, \n" +
                    "       j.hidden, \n" +
                    "       j.remarks, \n" +
                    "       j.cancel_requested \n" +
                    "FROM jobs AS j \n" +
                    "JOIN users AS u ON j.user_id = u.user_id \n" +
                    "JOIN projects AS p ON j.project_id = p.project_id \n" +
                    "JOIN job_types AS jt ON j.job_type_id = jt.job_type_id \n" +
                    "WHERE j.hidden = 0 \n" +
                    "AND j.completed = 1\n" +
                    " ORDER BY j.job_id DESC \n" +
                    "LIMIT 0, 100"
                ]={value:[{count:-111}]};
                
                jobs.find({is:['visible', 'completed']}, function(err, results){
                    should.not.exist(err);
                    results.should.deep.equal([{count:-111}]);
                    done();
                });
            });
        });
        [
            {param:'states'    , filter:'job state'   , field:'j.state'      },
            {param:'types'     , filter:'job type'    , field:'j.job_type_id'},
            {param:'project_id', filter:'project id'  , field:'j.project_id' },
            {param:'user_id'   , filter:'user id'     , field:'j.user_id'    },
            {param:'project'   , filter:'project name', field:'p.name'       },
            {param:'user'      , filter:'user login'  , field:'u.login'      },
            {param:'job_id'    , filter:'job id'      , field:'j.job_id'     },
        ].forEach(function(_){
            it('query.' + _.param + ' should filter by ' + _.filter + '.', function(done){
                dbpool.pool.cache[
                    "SELECT j.job_id, \n" +
                    "       j.progress, \n" +
                    "       j.progress_steps, \n" +
                    "       j.state, \n" +
                    "       j.completed, \n" +
                    "       u.login as user, \n" +
                    "       p.name as project, \n" +
                    "       j.project_id, \n" +
                    "       j.date_created AS created, \n" +
                    "       j.last_update, \n" +
                    "       jt.name as type, \n" +
                    "       j.hidden, \n" +
                    "       j.remarks, \n" +
                    "       j.cancel_requested \n" +
                    "FROM jobs AS j \n" +
                    "JOIN users AS u ON j.user_id = u.user_id \n" +
                    "JOIN projects AS p ON j.project_id = p.project_id \n" +
                    "JOIN job_types AS jt ON j.job_type_id = jt.job_type_id \n" +
                    "WHERE " + _.field + " IN (1, 2, 3)\n" +
                    " ORDER BY j.job_id DESC \n" +
                    "LIMIT 0, 100"
                ]={value:[{count:-111}]};
                var query={};
                query[_.param] = [1, 2, 3];
                jobs.find(query, function(err, results){
                    should.not.exist(err);
                    results.should.deep.equal([{count:-111}]);
                    done();
                });
            });
        });
    });
    describe('set_job_state()', function(){
        beforeEach(function(){
            mock_mysql.pool.cache = {};
        });
        it('should set the given job to the given state', function(done){
            dbpool.pool.cache[
                "UPDATE jobs \n"+
                "SET state = ?,\n" +
                "    last_update = NOW() \n" +
                "WHERE job_id = ?"
            ]={value:[{count:-111}]};
            
            jobs.set_job_state({id:1}, 'vaca', function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{count:-111}]);
                done();
            });
        });
    });
    describe('get_job_type()', function(){
        var original_job_types;
        beforeEach(function(){
            original_job_types = jobs.job_types;
            jobs.job_types = TEST_JOB_TYPES;
        });
        afterEach(function(){
            jobs.job_types = original_job_types;
        });
        it('should return the type id of the given (supported) job', function(){
            var type_id = jobs.get_job_type({type_id:-1003});
            expect(type_id).to.equal(-1003);
        });
        it('should return null if the given job is unsupported', function(){
            var type_id = jobs.get_job_type({type_id:-9999});
            expect(type_id).to.not.exist;
        });
    });
    describe('status()', function(){
        beforeEach(function(){
            mock_mysql.pool.cache = {};
            sinon.stub(jobs, 'getJobTypes');
            jobs.getJobTypes.yields(null, [
                {id:1, name:'jt1', enabled:true},
                {id:2, name:'jt2', enabled:false},
            ]);
        });
        afterEach(function(){
            jobs.getJobTypes.restore();
        });
        [
            {jobs:'', status:'no_data'  , description:'\'no_data\' if no jobs are available'},
            {jobs:'..........', status:'no_data'  , description:'\'no_data\' if no jobs of the type have been completed'},
            {jobs:'cccccccccc', status:'ok'       , description:'\'ok\' if >= 100% jobs of the type have been completed'},
            {jobs:'cccccccc..', status:'warning'  , description:'\'warning\' if at least 80% jobs of the type have been completed'},
            {jobs:'ccccccc...', status:'red_alert', description:'\'red_alert\' if less than 80% jobs of the type have been completed'},
        ].forEach(function(_){
            it('should return ' + _.description, function(done){
                dbpool.pool.cache[
                    "SELECT state \n" +
                    "FROM `jobs` \n" +
                    "WHERE job_type_id = ? \n" +
                    "AND state IN ('completed', 'error', 'canceled', 'stalled') \n" +
                    "ORDER BY job_id DESC \n" +
                    "LIMIT 0, 10"
                ]={value:_.jobs.split('').map(function(_){
                    return {state: _ == 'c' ? 'completed' : 'meh...'};
                })};
                
                jobs.status(function(err, results){
                    should.not.exist(err);
                    results.should.deep.equal([
                        {name:'jt1', status: _.status, enabled:true},
                        {name:'jt2', status: _.status, enabled:false},
                    ]);
                    done();
                });
            });
        });
    });
});
