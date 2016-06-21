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
// mock_mysql.pool.json_errors = true;
var users = pre_wire('../../model/users', {
    '../../utils/dbpool' :  dbpool,
    'mysql' : mock_mysql
});

describe('Users', function(){
    var pepe = {user_id:9393, login:'pepe', email:'pepe@site.com', password:'ABFABAB11ABABADDBA09', firstname:'Pepe', lastname:'User'};
    var project1 = {id:1,name:'p1', url:'project_1/', description:'pr1', is_private:1, is_enabled:1};
    describe('#findByUsername()', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should find a user, given its username', function(done){
            dbpool.pool.cache["SELECT * \nFROM users \nWHERE login = 'pepe'"]={value:[pepe]};
            users.findByUsername('pepe', function(err, results){
                should.not.exist(err);
                results.should.deep.equal([pepe]);
                done();
            });
        });        
        it('Should clean its input', function(done){
            var bobby = "Robert'; DROP TABLE users", clean_bobby=mock_mysql.escape(bobby);
            users.findByUsername(bobby, function(err, results){
                should.exist(err);
                err.message.should.equal("Query not in cache : SELECT * \nFROM users \nWHERE login = "+clean_bobby);
                done();
            });
        });
    });
    describe('#findByEmail()', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should find a user, given its email', function(done){
            dbpool.pool.cache["SELECT * \nFROM users \nWHERE email = 'pepe@site.com'"]={value:[pepe]};
            users.findByEmail('pepe@site.com', function(err, results){
                should.not.exist(err);
                results.should.deep.equal([pepe]);
                done();
            });
        });        
        it('Should clean its input', function(done){
            var bobby = "bobby@site.com'; DROP TABLE users", clean_bobby=mock_mysql.escape(bobby);
            users.findByEmail(bobby, function(err, results){
                should.exist(err);
                err.message.should.equal("Query not in cache : SELECT * \nFROM users \nWHERE email = "+clean_bobby);
                done();
            });
        });
    });
    describe('#findById()', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should find a user, given its id', function(done){
            dbpool.pool.cache[
                "SELECT * \n" + 
                "FROM users \n" + 
                "WHERE user_id = ?"
            ]={value:[pepe]};
            users.findById(9393, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([pepe]);
                done();
            });
        });        
        it('Should clean its input', function(done){
            var bobby = "80881'; DROP TABLE users", clean_bobby=mock_mysql.escape(bobby);
            users.findById(bobby, function(err, results){
                should.exist(err);
                err.message.should.equal("Query not in cache : SELECT * \nFROM users \nWHERE user_id = ?");
                done();
            });
        });
    });
    describe('#loginTry()', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should log an invalid login try', function(done){
            dbpool.pool.cache["INSERT INTO invalid_logins(`ip`, `user`, `reason`) \nVALUES ('1.1.1.1','pepe','msg')"]={value:{insertId:101}};
            users.loginTry('1.1.1.1', 'pepe', 'msg', function(err, results){
                should.not.exist(err);
                results.should.deep.equal({insertId:101});
                done();
            });
        });        
    });
    describe('#invalidLogins()', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should return the count of invalid logins for a given ip', function(done){
            dbpool.pool.cache[
                'SELECT COUNT(ip) as tries \n' +
                'FROM invalid_logins \n' +
                "WHERE ip = '1.1.1.1' \n" +
                'AND `time` BETWEEN (NOW() - interval 1 hour) and NOW()'
            ]={value:[{tries:0}]};
            users.invalidLogins('1.1.1.1', function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{tries:0}]);
                done();
            });
        });        
    });
    describe('#removeLoginTries()', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should remove the invalid login entries for a given ip', function(done){
            dbpool.pool.cache[
                "DELETE FROM `invalid_logins` WHERE ip = '1.1.1.1'"
            ]={value:{affectedRows: 2}};
            users.removeLoginTries('1.1.1.1', function(err, results){
                should.not.exist(err);
                results.should.deep.equal({affectedRows:2});
                done();
            });
        });        
    });
    describe('#search()', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should return the user_id, email and login of an user whose login or email matches the given value', function(done){
            dbpool.pool.cache[
                "SELECT user_id AS id, \n" +
                "       email, \n" +
                "       login AS username \n" +
                "FROM users \n" +
                "WHERE login LIKE '%pepe%' \n" +
                "OR email LIKE '%pepe%'"
            ]={value:[{
                user_id: pepe.user_id,
                email: pepe.email,
                username: pepe.login
            }]};
            users.search('pepe', function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{
                    user_id: pepe.user_id,
                    email: pepe.email,
                    username: pepe.login
                }]);
                done();
            });
        });        
    });
    describe('#update()', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should update the database with the given user data', function(done){
            dbpool.pool.cache[
                "UPDATE users \n" + 
                "SET `email` = ? \n" + 
                "WHERE user_id=?"
            ]={value:{affectedRows:1}};
            users.update({
                user_id: 9393,
                email: 'new-email@site.com'
            }, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([{affectedRows:1}, [[]]]);
                done();
            });
        });        
        it('Should fail if user_id is undefined', function(done){
            users.update({
                email: 'new-email@site.com'
            }, function(err, results){
                should.exist(err);
                err.message.should.equal("userData does not contain an user_id");
                should.not.exist(results);
                done();
            });
        });
    });
    describe('#insert()', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should insert the given user data to the database', function(done){
            dbpool.pool.cache[
                "INSERT INTO users \n" +
                "SET `login` = " + mock_mysql.escape(pepe.login) + "," +
                   " `email` = " + mock_mysql.escape(pepe.email) + "," + 
                   " `password` = " + mock_mysql.escape(pepe.password) + "," + 
                   " `firstname` = " + mock_mysql.escape(pepe.firstname) + "," + 
                   " `lastname` = " + mock_mysql.escape(pepe.lastname)
            ]={value:{insertId:101}};
            users.insert(pepe, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({insertId:101});
                done();
            });
        });
        var userdata={login:'a', email: 'b', password:'c', firstname:'d', lastname:'e'};
        Object.keys(userdata).forEach(function(key){
            var obj={};
            for(var k in userdata){
                if(k != key){
                    obj[k] = userdata[k];
                }
            }
            it('Should fail if '+key+' is not given', function(done){
                users.insert(obj, function(err, results){
                    should.exist(err);
                    err.message.should.equal("required field '"+key+"' missing");
                    should.not.exist(results);
                    done();
                });
            });
        });
    });
    describe('#projectList()', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should return the list of project available to the given user', function(done){
            dbpool.pool.cache[
                "SELECT p.project_id AS id, \n" + 
                "    name, \n" + 
                "    url, \n" + 
                "    description, \n" + 
                "    is_private, \n" + 
                "    is_enabled, \n" + 
                "    u.login AS `owner` \n" + 
                "FROM projects AS p \n" + 
                "JOIN user_project_role AS upr ON (p.project_id = upr.project_id and upr.role_id = 4) \n" + 
                "JOIN user_project_role AS upr2 ON (p.project_id = upr2.project_id) \n" + 
                "JOIN users AS u ON (upr.user_id = u.user_id) \n" + 
                "WHERE upr2.user_id = ? \n" + 
                "OR p.is_private = 0 \n" + 
                "GROUP BY p.project_id"
            ]={value:[project1]};
            users.projectList(9393, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([project1]);
                done();
            });
        });        
    });
    describe('#getPermissions()', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should return the list of permissions of a given user in a given project', function(done){
            dbpool.pool.cache[
                "SELECT p.permission_id AS id, p.name \n" + 
                "FROM user_project_role AS upr \n" + 
                "JOIN roles AS r ON upr.role_id = r.role_id \n" + 
                "JOIN role_permissions AS rp ON rp.role_id = upr.role_id \n" + 
                "JOIN permissions AS p ON p.permission_id = rp.permission_id \n" + 
                "WHERE upr.user_id = ? \n" + 
                "AND upr.project_id = ?"
            ]={value:[project1]};
            users.getPermissions(9393, 1, function(err, results){
                should.not.exist(err);
                results.should.deep.equal([project1]);
                done();
            });
        });        
    });
    // describe.skip('#ownedProjectsQty()', function(){
    //     beforeEach(function(){mock_mysql.pool.cache = {};});
    //     it('Should return number of projects owned by the given user', function(done){
    //         dbpool.pool.cache[
    //             "SELECT COUNT(p.project_id) as count \n" +
    //             "FROM projects as p \n" +
    //             "WHERE p.owner_id = 9393"
    //         ]={value:[{count:1}]};
    //         users.ownedProjectsQty(9393, function(err, results){
    //             should.not.exist(err);
    //             results.should.deep.equal([{count:1}]);
    //             done();
    //         });
    //     });        
    // });
    describe('#newAccountRequest()', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should insert a new account support request into the database', function(done){
            dbpool.pool.cache[
                "INSERT INTO user_account_support_request(support_type_id, hash, params, expires) \n" +
                "VALUES (1,'hash','{\\\"a\\\":9}',(\n" +
                "    SELECT FROM_UNIXTIME( \n" +
                "        UNIX_TIMESTAMP(now()) +\n" +
                "        (SELECT max_lifetime \n" +
                "         FROM user_account_support_type\n" +
                "         WHERE account_support_type_id = 1)\n" +
                "    ) as expiresin \n" +
                "))"
            ]={value:{insertId:101}};
            users.newAccountRequest({a:9}, 'hash', function(err, results){
                should.not.exist(err);
                results.should.deep.equal({insertId:101});
                done();
            });
        });        
    });
    describe('#newPasswordResetRequest()', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should insert a new password reset support request into the database', function(done){
            dbpool.pool.cache[
                "INSERT INTO user_account_support_request(support_type_id, user_id, hash, expires) \n" +
                "VALUES (2,9393,'hash',(\n" +
                "    SELECT FROM_UNIXTIME( \n" +
                "        UNIX_TIMESTAMP(now()) +\n" +
                "        (SELECT max_lifetime \n" +
                "         FROM user_account_support_type\n" +
                "         WHERE account_support_type_id = 2)\n" +
                "    ) as expiresin \n" +
                "))"
            ]={value:{insertId:101}};
            users.newPasswordResetRequest(9393, 'hash', function(err, results){
                should.not.exist(err);
                results.should.deep.equal({insertId:101});
                done();
            });
        });        
    });
    describe('#removeRequest()', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should remove a support request from the database', function(done){
            dbpool.pool.cache[
                "DELETE FROM user_account_support_request \n" +
                "WHERE support_request_id = 101"
            ]={value:{affectedRows:1}};
            users.removeRequest(101, function(err, results){
                should.not.exist(err);
                results.should.deep.equal({affectedRows:1});
                done();
            });
        });        
    });
    describe('#findAccountSupportReq()', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should find a support request given its hash', function(done){
            dbpool.pool.cache[
                "SELECT * \n" + 
                "FROM user_account_support_request \n" + 
                "WHERE hash = 'hash'"
            ]={value:{affectedRows:1}};
            users.findAccountSupportReq('hash', function(err, results){
                should.not.exist(err);
                results.should.deep.equal({affectedRows:1});
                done();
            });
        });        
    });
    describe('#usernameInUse()', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should reports wether a given username is in use or not', function(done){
            dbpool.pool.cache[
                "SELECT (SELECT count(*) as count \n" +
                "FROM user_account_support_request \n" +
                "WHERE params LIKE '%\\\"pepe\\\"%') \n" +
                "+\n" +
                "(SELECT count(*) as count \n" +
                "FROM users AS u \n" +
                "WHERE login = 'pepe') as count"
            ]={value:[{count:1}]};
            users.usernameInUse('pepe', function(err, results){
                should.not.exist(err);
                results.should.equal(true);
                done();
            });
        });        
        it('Should pass along any sql errors.', function(done){
            users.usernameInUse('pepe', function(err, results){
                should.exist(err);
                should.not.exist(results);
                done();
            });
        });
    });
    describe('#emailInUse()', function(){
        beforeEach(function(){mock_mysql.pool.cache = {};});
        it('Should reports wether a given email is in use or not', function(done){
            dbpool.pool.cache[
                "SELECT (SELECT count(*) as count \n" +
                "FROM user_account_support_request \n" +
                "WHERE params LIKE '%\\\"pepe@site.com\\\"%') \n" +
                "+\n" +
                "(SELECT count(*) as count \n" +
                "FROM users AS u \n" +
                "WHERE email = 'pepe@site.com') as count"
            ]={value:[{count:1}]};
            users.emailInUse('pepe@site.com', function(err, results){
                should.not.exist(err);
                results.should.equal(true);
                done();
            });
        });        
        it('Should pass along any sql errors.', function(done){
            users.emailInUse('pepe@site.com', function(err, results){
                should.exist(err);
                should.not.exist(results);
                done();
            });
        });
    });
    // describe('#emailInUse()', function(){
    // });
});
