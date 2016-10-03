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

var Tags = rewire('../../../app/model/tags');
Tags.__set__({
    dbpool : dbpool
});
var TagsProjects = Tags.__get__('projects');

describe('Tags', function(){
    describe('getTagsFor', function(){
        var rdefs;
        beforeEach(function(){
            rdefs = Tags.resourceDefs;
        });
        afterEach(function(){
            Tags.resourceDefs = rdefs;
        });
        it('should fetch the tags of a resource, given its type and id', function(done){
            Tags.resourceDefs = {test:{
                getFor: sinon.mock()
            }};
            Tags.resourceDefs.test.getFor.returns(q.resolve([1,2,3]));
            
            Tags.getTagsFor('test', 10101).then(function(tags){
                tags.should.deep.equal([1,2,3]);
                Tags.resourceDefs.test.getFor.callCount.should.equal(1);
                Tags.resourceDefs.test.getFor.args[0].should.deep.equal([10101]);
            }).then(done, done);
        });
        it('should fail if no such resource type exists', function(done){
            Tags.resourceDefs = {};
            
            Tags.getTagsFor('test', 10101).then(function(){
                throw new Error('Error was expected in test');
            }, function(err){
                err.message.should.equal('test resources do not support tags.');
            }).then(done, done);
        });
    });
    describe('getTagsForType', function(){
        var rdefs;
        beforeEach(function(){
            rdefs = Tags.resourceDefs;
        });
        afterEach(function(){
            Tags.resourceDefs = rdefs;
        });
        it('should fetch the tags of given resource type', function(done){
            Tags.resourceDefs = {test:{
                getForType: sinon.mock()
            }};
            Tags.resourceDefs.test.getForType.returns(q.resolve([1,2,3]));
            
            Tags.getTagsForType('test', 10101).then(function(tags){
                tags.should.deep.equal([1,2,3]);
                Tags.resourceDefs.test.getForType.callCount.should.equal(1);
                Tags.resourceDefs.test.getForType.args[0].should.deep.equal([10101]);
            }).then(done, done);
        });
        it('should fail if no such resource type exists', function(done){
            Tags.resourceDefs = {};
            
            Tags.getTagsForType('test', 10101).then(function(){
                throw new Error('Error was expected in test');
            }, function(err){
                err.message.should.equal('test resources do not support tags.');
            }).then(done, done);
        });
    });
    describe('addTagTo', function(){
        var rdefs;
        beforeEach(function(){
            rdefs = Tags.resourceDefs;
        });
        afterEach(function(){
            Tags.resourceDefs = rdefs;
        });
        it('should add a tag to a given resource', function(done){
            Tags.resourceDefs = {test:{
                addTo: sinon.mock()
            }};
            Tags.resourceDefs.test.addTo.returns(q.resolve([1,2,3]));
            
            Tags.addTagTo('test', 10101, {tag:'tag'}).then(function(tags){
                tags.should.deep.equal([1,2,3]);
                Tags.resourceDefs.test.addTo.callCount.should.equal(1);
                Tags.resourceDefs.test.addTo.args[0].should.deep.equal([10101, {tag:'tag'}]);
            }).then(done, done);
        });
        it('should fail if no such resource type exists', function(done){
            Tags.resourceDefs = {};
            
            Tags.addTagTo('test', 10101, {tag:'tag'}).then(function(){
                throw new Error('Error was expected in test');
            }, function(err){
                err.message.should.equal('test resources do not support tags.');
            }).then(done, done);
        });
    });
    describe('removeTagFrom', function(){
        var rdefs;
        beforeEach(function(){
            rdefs = Tags.resourceDefs;
        });
        afterEach(function(){
            Tags.resourceDefs = rdefs;
        });
        it('should remove a tag from a given resource', function(done){
            Tags.resourceDefs = {test:{
                removeFrom: sinon.mock()
            }};
            Tags.resourceDefs.test.removeFrom.returns(q.resolve([1,2,3]));
            
            Tags.removeTagFrom('test', 10101, -910110).then(function(tags){
                tags.should.deep.equal([1,2,3]);
                Tags.resourceDefs.test.removeFrom.callCount.should.equal(1);
                Tags.resourceDefs.test.removeFrom.args[0].should.deep.equal([10101, -910110]);
            }).then(done, done);
        });
        it('should fail if no such resource type exists', function(done){
            Tags.resourceDefs = {};
            
            Tags.removeTagFrom('test', 10101, -910110).then(function(){
                throw new Error('Error was expected in test');
            }, function(err){
                err.message.should.equal('test resources do not support tags.');
            }).then(done, done);
        });
    });
    describe('getFor', function(){
        beforeEach(function(){
            dbpool.pool.cache = {};
        });
        it('should get the tags matching the given query', function(done){
            dbpool.pool.cache[
                "SELECT T.tag_id, T.tag, 'tag' as type\n" +
                "FROM tags T\n" +
                "WHERE (T.tag_id IN (?))"
            ] = {value:[{a:1,b:2}]};
            Tags.getFor({id:[1,2,3,4]}).then(function(rows){
                rows.should.deep.equal([{a:1,b:2}]);
            }).then(done, done);
        });
        it('all tags are fetched by default', function(done){
            dbpool.pool.cache[
                "SELECT T.tag_id, T.tag, 'tag' as type\n" +
                "FROM tags T\n"
            ] = {value:[{a:1,b:2}]};
            Tags.getFor().then(function(rows){
                rows.should.deep.equal([{a:1,b:2}]);
            }).then(done, done);
        });
    });
    describe('search', function(){
        beforeEach(function(){
            dbpool.pool.cache = {};
        });
        it('should search the tags matching the given query', function(done){
            dbpool.pool.cache[
                "SELECT T.tag_id, T.tag, 'tag' as type\n" +
                "FROM tags T\n" +
                "WHERE T.tag LIKE ?\n"+
                "ORDER BY T.tag\n" +
                "LIMIT ? OFFSET ?"
            ] = {value:[{a:1,b:2}]};
            Tags.search({q:'a'}).then(function(rows){
                rows.should.deep.equal([{a:1,b:2}]);
            }).then(done, done);
        });
        it('query is optional', function(done){
            dbpool.pool.cache[
                "SELECT T.tag_id, T.tag, 'tag' as type\n" +
                "FROM tags T\n" +
                "WHERE T.tag LIKE ?\n"+
                "ORDER BY T.tag\n" +
                "LIMIT ? OFFSET ?"
            ] = {value:[{a:1,b:2}]};
            Tags.search({}).then(function(rows){
                rows.should.deep.equal([{a:1,b:2}]);
            }).then(done, done);
        });
        it('limit can be specified', function(done){
            dbpool.pool.cache[
                "SELECT T.tag_id, T.tag, 'tag' as type\n" +
                "FROM tags T\n" +
                "WHERE T.tag LIKE ?\n"+
                "ORDER BY T.tag\n" +
                "LIMIT ? OFFSET ?"
            ] = {value:[{a:1,b:2}]};
            Tags.search({limit:12}).then(function(rows){
                rows.should.deep.equal([{a:1,b:2}]);
            }).then(done, done);
        });
        it('offset can be specified', function(done){
            dbpool.pool.cache[
                "SELECT T.tag_id, T.tag, 'tag' as type\n" +
                "FROM tags T\n" +
                "WHERE T.tag LIKE ?\n"+
                "ORDER BY T.tag\n" +
                "LIMIT ? OFFSET ?"
            ] = {value:[{a:1,b:2}]};
            Tags.search({offset:12}).then(function(rows){
                rows.should.deep.equal([{a:1,b:2}]);
            }).then(done, done);
        });
    });
    describe('resourceDefs', function(){
        describe('recording', function(){
            describe('getFor', function(){
                beforeEach(function(){
                    dbpool.pool.cache = {};
                });
                it('should get the tags for a given recording', function(done){
                    dbpool.pool.cache[
                        "SELECT RT.recording_tag_id as id, T.tag_id, T.tag, user_id, datetime, t0, f0, t1, f1\n" +
                        "FROM recording_tags RT\n" +
                        "JOIN tags T ON RT.tag_id = T.tag_id\n" +
                        "WHERE RT.recording_id = ?"
                    ] = {value:[{a:1,b:2}]};
                    Tags.resourceDefs.recording.getFor(-556101).then(function(rows){
                        rows.should.deep.equal([{a:1,b:2}]);
                    }).then(done, done);
                });
            });
            describe('getForType', function(){
                beforeEach(function(){
                    dbpool.pool.cache = {};
                    sinon.stub(TagsProjects, 'getProjectSites');
                });
                afterEach(function(){
                    TagsProjects.getProjectSites.restore();
                });
                it('should get the tags for a given recording', function(done){
                    dbpool.pool.cache[
                        "SELECT T.tag_id, T.tag, COUNT(*) as count\n" +
                        "FROM tags T\n" +
                        "JOIN recording_tags RT ON RT.tag_id = T.tag_id\n" +
                        "GROUP BY T.tag_id"
                    ] = {value:[{a:1,b:2}]};
                    Tags.resourceDefs.recording.getForType().then(function(rows){
                        rows.should.deep.equal([{a:1,b:2}]);
                    }).then(done, done);
                });
                it('can filter by project', function(done){
                    TagsProjects.getProjectSites.returns(q.resolve([{id:1},{id:4}]));
                    dbpool.pool.cache[
                        "SELECT T.tag_id, T.tag, COUNT(*) as count\n" +
                        "FROM tags T\n" +
                        "JOIN recording_tags RT ON RT.tag_id = T.tag_id\n" +
                        "JOIN recordings R ON R.recording_id = RT.recording_id\n" +
                        "JOIN sites S ON S.site_id = R.site_id\n" +
                        "WHERE S.site_id IN (1, 4)\n" +
                        "GROUP BY T.tag_id"
                    ] = {value:[{a:1,b:2}]};
                    Tags.resourceDefs.recording.getForType({project:1}).then(function(rows){
                        rows.should.deep.equal([{a:1,b:2}]);
                    }).then(done, done);
                });
            });
            describe('addTo', function(){
                beforeEach(function(){
                    dbpool.pool.cache = {};
                });
                it('should add a tag to a given recording', function(done){
                    dbpool.pool.cache[
                        "INSERT INTO recording_tags(recording_id, tag_id, user_id, datetime, t0, f0, t1, f1)\n"+
                        "VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)"
                    ] = {value:{insertId:22222222}};
                    dbpool.pool.cache[
                        "SELECT RT.recording_tag_id as id, T.tag_id, T.tag, user_id, datetime, t0, f0, t1, f1\n" +
                        "FROM recording_tags RT\n" +
                        "JOIN tags T ON RT.tag_id = T.tag_id\n" +
                        "WHERE RT.recording_tag_id = ?"
                    ] = {value:[{id:1, tag_id:9, tag:'tag', user_id:11, datetime:'1aug11', t0:1,f0:2,t1:3,f1:4}]};
                    
                    Tags.resourceDefs.recording.addTo(-1121, {id:77, user:{id:1121}, t0:1,t1:2,f0:3,f1:4}).then(function(rows){
                        rows.should.deep.equal([{id:1, tag_id:9, tag:'tag', user_id:11, datetime:'1aug11', t0:1,f0:2,t1:3,f1:4}]);
                    }).then(done, done);
                });
                it('should create the tag if the tag doesnt exists (tag must have text)', function(done){
                    dbpool.pool.cache[
                        "INSERT IGNORE INTO tags(tag) VALUES (?)"
                    ] = {value:{insertId:11111111}};
                    dbpool.pool.cache[
                        "SELECT tag_id FROM tags WHERE tag = ?"
                    ] = {value:[[{tag_id:11}]]};
                    dbpool.pool.cache[
                        "INSERT INTO recording_tags(recording_id, tag_id, user_id, datetime, t0, f0, t1, f1)\n"+
                        "VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)"
                    ] = {value:{insertId:22222222}};
                    dbpool.pool.cache[
                        "SELECT RT.recording_tag_id as id, T.tag_id, T.tag, user_id, datetime, t0, f0, t1, f1\n" +
                        "FROM recording_tags RT\n" +
                        "JOIN tags T ON RT.tag_id = T.tag_id\n" +
                        "WHERE RT.recording_tag_id = ?"
                    ] = {value:[{id:1, tag_id:9, tag:'tag', user_id:11, datetime:'1aug11', t0:1,f0:2,t1:3,f1:4}]};
                    
                    Tags.resourceDefs.recording.addTo(-1121, {text:"tag#3", user:{id:1121}}).then(function(rows){
                        rows.should.deep.equal([{id:1, tag_id:9, tag:'tag', user_id:11, datetime:'1aug11', t0:1,f0:2,t1:3,f1:4}]);
                    }).then(done, done);
                });
                it('should fetch the tag if the tag exists but no id is given (tag must have text)', function(done){
                    dbpool.pool.cache[
                        "SELECT tag_id FROM tags WHERE tag = ?"
                    ] = {value:[[{tag_id:11}]]};
                    dbpool.pool.cache[
                        "INSERT INTO recording_tags(recording_id, tag_id, user_id, datetime, t0, f0, t1, f1)\n"+
                        "VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)"
                    ] = {value:{insertId:22222222}};
                    dbpool.pool.cache[
                        "SELECT RT.recording_tag_id as id, T.tag_id, T.tag, user_id, datetime, t0, f0, t1, f1\n" +
                        "FROM recording_tags RT\n" +
                        "JOIN tags T ON RT.tag_id = T.tag_id\n" +
                        "WHERE RT.recording_tag_id = ?"
                    ] = {value:[{id:1, tag_id:9, tag:'tag', user_id:11, datetime:'1aug11', t0:1,f0:2,t1:3,f1:4}]};
                    
                    Tags.resourceDefs.recording.addTo(-1121, {text:"tag#3", user:{id:1121}}).then(function(rows){
                        rows.should.deep.equal([{id:1, tag_id:9, tag:'tag', user_id:11, datetime:'1aug11', t0:1,f0:2,t1:3,f1:4}]);
                    }).then(done, done);
                });
                it('should fail if tag object has no user', function(done){
                    Tags.resourceDefs.recording.addTo(-1121, {id:77}).then(function(rows){
                        throw new Error('Expected an error.');
                    }, function(){
                    }).then(done, done);
                });
                it('should fail if tag object has no id and no text', function(done){
                    Tags.resourceDefs.recording.addTo(-1121, {user:{id:1121}}).then(function(rows){
                        throw new Error('Expected an error.');
                    }, function(){
                    }).then(done, done);
                });
            });
            describe('removeFrom', function(){
                beforeEach(function(){
                    dbpool.pool.cache = {};
                });
                it('should remove a tag from a given recording', function(done){
                    dbpool.pool.cache[
                        "DELETE FROM recording_tags\n" +
                        "WHERE recording_id = ? AND recording_tag_id = ?"
                    ] = {value:{affectedRows:1}};
                    Tags.resourceDefs.recording.removeFrom(-556101, 3303).then(function(rows){
                        rows.should.deep.equal({affectedRows:1});
                    }).then(done, done);
                });
            });
        });
    });
    // 
    // describe('consumeCode', function(){
    //     beforeEach(function(){
    //         mock_mysql.pool.cache = {};
    //     });
    //     it('should consume an activation code', function(done){
    //         mock_mysql.pool.cache[
    //             "UPDATE activation_codes\n"+
    //             "SET consumed=1, consumer=?\n"+
    //             "WHERE activation_code_id=?"
    //         ] = {value:{affectedRows:1}};
    //         Tags.consumeCode(1, {id:1112}).then(function(data){
    //             expect(data).to.exist;
    //             data.should.deep.equal({affectedRows:1});
    //         }).then(done, done);
    //     });
    // });
});
