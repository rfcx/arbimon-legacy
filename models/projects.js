var debug = require('debug')('arbimon2:model:projects');
var util = require('util');
var mysql = require('mysql');
var async = require('async');
var Joi = require('joi');
var sprintf = require("sprintf-js").sprintf;
var AWS = require('aws-sdk');
var config       = require('../config');
var s3;
var dbpool = require('../utils/dbpool');
var queryHandler = dbpool.queryHandler;

var species = require('./species');
var songtypes = require('./songtypes');

var Projects = {
    
    listAll: function(callback) {
        var q = "SELECT name, url, description, is_private, is_enabled \n"+
                "FROM projects";

        queryHandler(q, callback);
    },
    
    findById: function (project_id, callback) {
        var query = "SELECT * FROM projects WHERE project_id = " + mysql.escape(project_id);

        return queryHandler(query , callback);
    },
    
    findByUrl: function (project_url, callback) {
        var query = "SELECT * FROM projects WHERE url = " + mysql.escape(project_url);

        return queryHandler(query , callback);
    },

    findByName: function (project_name, callback) {
        var query = "SELECT * FROM projects WHERE name = " + mysql.escape(project_name);

        return queryHandler(query , callback);
    },

    getProjectSites: function(project_id, callback){
        if(typeof project_id !== 'number')
            return callback(new Error("invalid type for 'project_id'"));
        
        var q = "SELECT s.site_id as id, \n"+
                        "s.name, \n"+
                        "s.lat, \n"+
                        "s.lon, \n"+
                        "s.alt, \n"+
                        "count( r.recording_id ) as rec_count \n"+
                "FROM sites AS s \n"+
                "LEFT JOIN recordings AS r ON s.site_id = r.site_id \n"+
                "WHERE s.project_id = %s \n"+
                "GROUP BY s.site_id";
        
        q = util.format(q, mysql.escape(project_id));
        return queryHandler(q , callback);
    },

    insert: function(project, callback) {
        var values = [];

        var requiredValues = [
            "name",
            "url",
            "description",
            "owner_id",
            "project_type_id",
            "is_private"
        ];

        for(var i in requiredValues) {
            if(typeof project[requiredValues[i]] === "undefined")
                return callback(new Error("required field '"+ requiredValues[i] + "' missing"));
        }

        for(i in project) {
            if(i !== 'id') {
                project[i] = mysql.escape(project[i]);
                values.push(util.format('`%s`=%s', i, project[i]));
            }
        }

        var q = 'INSERT INTO projects \n'+
                'SET %s';

        q = util.format(q, values.join(", "));

        queryHandler(q, callback);
    },

    update: function(project, callback) {
        
        var schema = {
            project_id: Joi.number(),
            name: Joi.string().optional(),
            url: Joi.string().optional(),
            description: Joi.string().optional(),
            owner_id: Joi.number().optional(),
            project_type_id: Joi.number().optional(),
            is_private: Joi.number().optional(),
            is_enabled: Joi.number().optional(),
            recording_limit: Joi.number().optional()
        }
        
        Joi.validate(project, schema, function(err, projectInfo){
            if(err) return callback(err);
            
            var values = [];
            
            for( var i in projectInfo) {
                if(i !== 'project_id' && i !== 'recording_limit') {
                    projectInfo[i] = mysql.escape(projectInfo[i]);
                    values.push(util.format('`%s`=%s', i, projectInfo[i]));
                }
            }
            
            var q = 'UPDATE projects \n'+
                    'SET %s \n'+
                    'WHERE project_id = %s';

            q = util.format(q, values.join(", "), projectInfo.project_id);
            queryHandler(q, callback);
        });
    },
    
    insertNews: function(news, callback) {
        
        var schema = {
            user_id: Joi.number().required(), 
            project_id: Joi.number().required(), 
            data: Joi.string().required(), 
            news_type_id: Joi.number().required()
        };
        
        Joi.validate(news, schema, function(err, newsVal) {
            if(err) {
                if(callback) 
                    return callback(err);
                    
                else 
                    throw err;
            }
            
            var q = 'INSERT INTO project_news \n'+
                    'SET user_id = %s, '+
                    'project_id = %s, '+
                    'data = %s, '+
                    'news_type_id = %s';

            q = util.format(q, 
                mysql.escape(newsVal.user_id), 
                mysql.escape(newsVal.project_id), 
                mysql.escape(newsVal.data), 
                mysql.escape(newsVal.news_type_id)
            );
            
            queryHandler(q, function(err, result) {
                if(callback) {
                    if(err) return callback(err);
                    
                    return callback(result);
                }
                else {
                    if(err) throw err;
                }
            });
            
        });
    },

    /** Fetches a project's classes.
     * @param {{Object}} project project object.
     * @param {{Integer}} project.project_id
     * @param {{Integer}} class_id (optional) limit the query to this class
     * @param {{Callback}} callback
     */
    getProjectClasses: function(project_id, class_id, callback){
        if(class_id instanceof Function){
            callback = class_id;
            class_id = null;
        }
        var sql = (
            "SELECT pc.project_class_id as id, \n"+
            "       pc.species_id as species, \n"+
            "       pc.songtype_id as songtype, \n"+
            "       sp.scientific_name as species_name, \n"+
            "       so.songtype as songtype_name \n"+
            "FROM project_classes AS pc \n"+
            "JOIN species AS sp on sp.species_id = pc.species_id \n"+
            "JOIN songtypes AS so on so.songtype_id = pc.songtype_id \n" +
            "WHERE pc.project_id = " + mysql.escape(project_id) +
            (class_id ? "\n  AND pc.project_class_id = " + (class_id|0) : '') +
            " ORDER BY species_name"
        );

        return queryHandler(sql , callback);
    },

    insertClass: function(project_class, callback) {
        var schema = {
            species: Joi.string(),
            songtype: Joi.string(),
            project_id: Joi.number()
        };

        Joi.validate(project_class, schema, function(err, value) {
            if(err) return callback(err);

            async.auto({
                findSpecies: function(cb) {
                    species.findByName(value.species, function(err, rows) {
                        if(err) return cb(err);

                        if(!rows.length)
                            return cb(new Error(util.format("species '%s' not in system", value.species)));

                        cb(null, rows);
                    });
                },
                findSong: function(cb) {
                    songtypes.findByName(value.songtype, function(err, rows) {
                        if(err) return cb(err);

                        if(!rows.length)
                            return cb(new Error(util.format("songtype '%s' not in system", value.songtype)));

                        cb(null, rows);
                    });
                },

                classExists: ['findSpecies', 'findSong', function(cb, results){
                    
                    var q = "SELECT count(*) as count \n"+
                            "FROM project_classes \n"+
                            "WHERE project_id = %s \n"+
                            "AND species_id = %s \n"+
                            "AND songtype_id = %s";

                    var species_id = results.findSpecies[0].id;
                    var songtype_id = results.findSong[0].id;
                    var project_id = value.project_id;

                    q = util.format(q, project_id, species_id, songtype_id);
                    queryHandler(q , function(err, rows) {
                        if(err) return cb(err);

                        cb(null, rows[0].count > 0);
                    });
                }],

                insert: ['classExists', function(cb, results){

                    if(results.classExists)
                        return cb(null, { error: "class already in project" });
                    
                    var q = 'INSERT INTO project_classes \n'+
                            'SET project_id = %s, species_id = %s, songtype_id = %s';

                    var species_id = results.findSpecies[0].id;
                    var songtype_id = results.findSong[0].id;
                    var project_id = value.project_id;

                    q = util.format(q, project_id, species_id, songtype_id);
                    queryHandler(q , function(err, row) {
                        if(err) return cb(err);

                        cb(null, row);
                    });
                }]
            },
            function(err, results) {
                if(err) return callback(err);

                callback(null, results.insert);
            });
        });
    },

    removeClasses: function(project_classes, callback) {
        var schema = Joi.array().min(1).includes(Joi.number());

        Joi.validate(project_classes, schema, function(err, value) {
            if(err) return callback(err);

            value = '(' + mysql.escape(value) + ')';

            var q = "DELETE FROM project_classes \n"+
                    "WHERE project_class_id IN %s";

            q = util.format(q, value);
            queryHandler(q, callback);
        });
    },
    
    getUsers: function(project_id, callback){ 
        
        if(typeof project_id !== 'number')
            return callback(new Error("invalid type for 'project_id'"));
        
        var q = "SELECT u.login AS username, \n"+
                "       u.user_id AS id, \n"+
                "       u.email, \n"+
                "       r.name AS rolename \n"+
                "FROM users AS u \n"+
                "JOIN user_project_role AS upr ON u.user_id = upr.user_id \n"+
                "JOIN roles AS r on upr.role_id = r.role_id \n"+
                "WHERE upr.project_id = %s";
        
        q = util.format(q, project_id);
        queryHandler(q, callback);
    },
    
    addUser: function(userProjectRole, callback) {
        var schema = {
            user_id: Joi.number(),
            project_id: Joi.number(),
            role_id: Joi.number()
        };
        
        Joi.validate(userProjectRole, schema, function(err, upr){
            if(err) return callback(err);
            
            var user_id = mysql.escape(upr.user_id);
            var project_id = mysql.escape(upr.project_id);
            var role_id = mysql.escape(upr.role_id);
            
            var q = 'INSERT INTO user_project_role \n'+
                    'SET user_id = %s, role_id = %s, project_id = %s';
            
            q = util.format(q, user_id, role_id, project_id);
            queryHandler(q, callback);
        });

    },
    
    changeUserRole: function(userProjectRole, callback) {
        var schema = {
            user_id: Joi.number(),
            project_id: Joi.number(),
            role_id: Joi.number()
        };
            
        Joi.validate(userProjectRole, schema, function(err, upr){
            if(err) return callback(err);
            
            var user_id = mysql.escape(upr.user_id);
            var project_id = mysql.escape(upr.project_id);
            var role_id = mysql.escape(upr.role_id);
            
            var q = "UPDATE user_project_role \n"+
                    "SET role_id = %s \n"+
                    "WHERE user_id = %s \n"+
                    "AND project_id = %s";
            
            q = util.format(q, role_id, user_id, project_id);
            queryHandler(q, callback);
        });
    },

    modelList: function(project_url, callback) {
        var q = "SELECT m.model_id, CONCAT(UCASE(LEFT(m.name, 1)), SUBSTRING(m.name, 2)) as mname "+
                " ,UNIX_TIMESTAMP( m.`date_created` )*1000 as date "+
                " , CONCAT(CONCAT(UCASE(LEFT(u.firstname, 1)), SUBSTRING(u.firstname, 2)) ,"+
                "  ' ', CONCAT(UCASE(LEFT(u.lastname, 1)), SUBSTRING(u.lastname, 2)) ) as muser " + 
                " , mt.name as mtname "+
                " FROM `models` as m,`model_types` as mt , `users` as u , `projects` as p "+
                " WHERE p.url  = "+mysql.escape(project_url)+
                " and m.`model_type_id` = mt.`model_type_id` and m.user_id = u.user_id "+
                " and p.project_id = m.project_id and m.deleted = 0";

            queryHandler(q, callback);
    },
       
    classifications: function(project_url, callback) {
            var q = "SELECT UNIX_TIMESTAMP( j.`date_created` )*1000  as date "+
                    "  , j.`job_id`  , "+
                     " CONCAT(UCASE(LEFT(mode.`name`, 1)), SUBSTRING(mode.`name`, 2))  as modname  " +         
                    " , CONCAT(UCASE(LEFT(jpc.`name`, 1)), SUBSTRING(jpc.`name`, 2))  as cname  "+
                    " , CONCAT(CONCAT(UCASE(LEFT(u.firstname, 1)), SUBSTRING(u.firstname, 2)) ,"+
                    "  ' ', CONCAT(UCASE(LEFT(u.lastname, 1)), SUBSTRING(u.lastname, 2)) ) as muser " + 
                    " from `models` as mode , `jobs` as j ,`job_params_classification` as jpc , `projects` as p , `users` as u "+
                    " WHERE mode.`model_id` = jpc.`model_id` and p.url  = "+mysql.escape(project_url)+" and j.`project_id` = p.`project_id`  and "+
                    " j.`job_id` = jpc.`job_id` and j.`job_type_id` = 2 and j.`completed` = 1 and u.`user_id` = j.`user_id`";

        queryHandler(q, callback);
    },
    
    classificationName: function(cid, callback) {
        var q = "select  REPLACE(lower(c.`name`),' ','_')  as name  "+
                " from   `job_params_classification`  c where c.`job_id` = "+mysql.escape(cid);

        queryHandler(q, callback);
    },
    
    classificationDelete: function(cid, callback) {
        var modUri = ''
        var q = "SELECT `uri` FROM `models` WHERE `model_id` = "+
            "(SELECT `model_id` FROM `job_params_classification` WHERE `job_id` = "+cid+")";
        queryHandler(q,
            function(err,data)
            {
                if(err) return callback(err);
                modUri = data[0].uri.replace('.mod','');
                q = "SELECT `uri` FROM `recordings` WHERE `recording_id` in "+
                "(SELECT `recording_id` FROM `classification_results` WHERE `job_id` = "+cid+") ";
                queryHandler(q,
                    function(err,data)
                    {
                        if(err) return callback(err);
                        var allToDelete = [];
                        async.eachLimit(data,5,
                        function (elem,callb)
                        {
                            var uri = elem.uri.split("/");
                            uri = uri[uri.length-1]
                            var cido = parseInt(cid.replace("'",""));
                            allToDelete.push({Key:modUri+'/classification_'+cido+'_'+uri+'.vector'})
                            callb();
                        }
                        ,
                        function(err){
                            if (err){
                                return callback(err);
                            }

                            
                            if (allToDelete.length==0)
                            {
                               var q = "DELETE FROM `classification_results` WHERE `job_id` ="+cid
                               console.log('exc quer 1')
                               queryHandler(q,function(err,row)
                                   {
                                       if (err)
                                       {
                                           callback(err);
                                       }
                                       else
                                       {    
                                           var q = "DELETE FROM `classification_stats` WHERE `job_id` = "+cid ;
                                           console.log('exc quer 2')
                                           queryHandler(q,
                                                function(err,row)
                                                {
                                                    if (err)
                                                    {
                                                        callback(err);
                                                    }
                                                    else
                                                    {    
                                                        var q = "DELETE FROM `job_params_classification` WHERE `job_id` ="+cid;
                                                        console.log('exc quer 3')
                                                        queryHandler(q,            
                                                            function(err,data)
                                                            {
                                                                if (err){
                                                                    callback(err);
                                                                }
                                                                callback(null,{data:"Classification deleted succesfully"});
                                                            }
                                                        )
                                                    }
                                                }
                                            );
                                       }
                                   }
                               );
                            }
                            else
                            {
                                if(!s3){
                                    s3 = new AWS.S3();
                                }
                                var params = {
                                    Bucket: config('aws').bucketName,
                                    Delete: { 
                                        Objects:allToDelete
                                    }
                                };
                                s3.deleteObjects(params, function(err, data) {
                                   if (err)
                                   {console.log('error!!:',err)
                                       callback(err);
                                   }
                                   else
                                   {
                                       var q = "DELETE FROM `classification_results` WHERE `job_id` ="+cid
                                       console.log('exc quer 1')
                                       queryHandler(q,function(err,row)
                                           {
                                               if (err)
                                               {
                                                   callback(err);
                                               }
                                               else
                                               {    
                                                   var q = "DELETE FROM `classification_stats` WHERE `job_id` = "+cid ;
                                                   console.log('exc quer 2')
                                                   queryHandler(q,
                                                        function(err,row)
                                                        {
                                                            if (err)
                                                            {
                                                                callback(err);
                                                            }
                                                            else
                                                            {    
                                                                var q = "DELETE FROM `job_params_classification` WHERE `job_id` ="+cid;
                                                                console.log('exc quer 3')
                                                                queryHandler(q,            
                                                                    function(err,data)
                                                                    {
                                                                        if (err){
                                                                            callback(err);
                                                                        }
                                                                        callback(null,{data:"Classification deleted succesfully"});
                                                                    }
                                                                )
                                                            }
                                                        }
                                                    );
                                               }
                                           }
                                       );
                                   }
                                });
                            }
                        });
                            
                    }
                ); 
            }
        );
    },
    
    classificationCsvData: function(cid, callback) {
        var q = "SELECT extract(year from r.`datetime`) year , "+
                "extract(month from r.`datetime`) month , "+
                "extract(day from r.`datetime`) day , "+
                "extract(hour from r.`datetime`) hour , "+
                "extract(minute from r.`datetime`) min ,  "+
                " m.`threshold` , "+
                " m.`uri` , "+
                " r.`uri` ruri  , "+
		" cr.`max_vector_value` as mvv ," +
                "SUBSTRING_INDEX(r.`uri` ,'/',-1 ) rec , cr.`present` , s.`name` , sp.`scientific_name` , st.`songtype` "+
                "FROM `models` m , `job_params_classification`  jpc, `species` sp, `classification_results` cr, `recordings` r, `sites` s, `songtypes` st "+
                "WHERE cr.`job_id` ="+mysql.escape(cid)+" "+
                "AND jpc.`job_id` = cr.`job_id` "+
                "AND jpc.`model_id` = m.`model_id` "+
                "AND cr.`recording_id` = r.`recording_id` "+
                "AND s.`site_id` = r.`site_id` "+
                "AND sp.`species_id` = cr.`species_id` "+
                "AND cr.`songtype_id` = st.`songtype_id`  "

        queryHandler(q, callback);
    },
    
    classificationErrors: function(project_url,cid, callback) {
        var q = "select count(*) as count "+
                " from  `recordings_errors`  where `job_id` = "+mysql.escape(cid)

        queryHandler(q, callback);
    },
    
    classificationDetail: function(project_url, cid, callback) {
        var q = "select  c.`species_id` ,c.`songtype_id`,c.`present`  , "+
                " CONCAT(UCASE(LEFT(st.`songtype`, 1)), SUBSTRING(st.`songtype`, 2)) as songtype , "+
                " CONCAT(UCASE(LEFT(s.`scientific_name`, 1)), SUBSTRING(s.`scientific_name`, 2)) as scientific_name ,"+
                "  mm.`threshold` as th "+
                " from  `models` mm,`job_params_classification`jpc ,`classification_results` c,`species` as s , `songtypes` as st where c.`job_id` = "+mysql.escape(cid)+
                " and c.`species_id` = s.`species_id` and c.`songtype_id` = st.`songtype_id` and jpc.`job_id` = c.`job_id` and mm.`model_id` = jpc.`model_id`" ;

        queryHandler(q, callback);
    },
    
    classificationDetailMore: function(project_url, cid, from, total, callback) {
        var q = "select cs.`json_stats`,  c.`species_id` ,c.`songtype_id`,c.`present` as present  , c.`recording_id`,SUBSTRING_INDEX(SUBSTRING_INDEX( r.`uri` , '.', 1 ),'/',-1 ) as recname ,CONCAT( SUBSTRING_INDEX( r.`uri` , '.', 1 ) , '.thumbnail.png') as uri,"+
                " CONCAT(UCASE(LEFT(st.`songtype`, 1)), SUBSTRING(st.`songtype`, 2)) as songtype , "+
                " CONCAT(SUBSTRING_INDEX( m.`uri` , '.', 1 ),'/classification_',c.`job_id`,'_',SUBSTRING_INDEX(r.`uri` ,'/',-1 ),'.vector') as vect,"+
                " CONCAT(UCASE(LEFT(s.`scientific_name`, 1)), SUBSTRING(s.`scientific_name`, 2)) as scientific_name  "+
                " from `classification_stats`  cs , `models` m ,`job_params_classification` jpc, `recordings` r,  `classification_results` c,`species` as s , `songtypes` as st where c.`job_id` = "+mysql.escape(cid)+
                " and c.`job_id` = cs.`job_id` and m.`model_id` = jpc.`model_id` and jpc.`job_id` = c.`job_id` and c.`species_id` = s.`species_id` and c.`songtype_id` = st.`songtype_id` and r.`recording_id` = c.`recording_id` "+
                " order by present desc LIMIT "+parseInt(from)+" , "+parseInt(total) ;
                queryHandler(q, callback);
    },
   
    trainingSets: function(project_url, callback) {
        var q = "SELECT (select count(x1) from  `training_set_roi_set_data` tsrsd where tsrsd.`training_set_id` = ts.`training_set_id`) as count ,"+
                " ts.`training_set_id` , CONCAT(UCASE(LEFT(ts.`name`, 1)), SUBSTRING(ts.`name`, 2)) as name "+
                " , ts.`date_created` , CONCAT(UCASE(LEFT(st.`songtype`, 1)), SUBSTRING(st.`songtype`, 2)) as songtype "+
                " , CONCAT(UCASE(LEFT(s.`scientific_name`, 1)), SUBSTRING(s.`scientific_name`, 2)) as scientific_name " +
                " , tsrs.`species_id` , tsrs.`songtype_id` " +
                " FROM `training_sets` ts, `projects` p ,`training_sets_roi_set` tsrs , `songtypes` st , `species` s" +
                " where ts.`training_set_id` = tsrs.`training_set_id` and "+
                " st.`songtype_id` = tsrs.`songtype_id` and s.`species_id`  = tsrs.`species_id` " +  	
                " and ts.`project_id` = p.`project_id` and p.`url` = " + mysql.escape(project_url);

        queryHandler(q, callback);
    },

    validationSets: function(project_url, callback) {
        var q = "SELECT `validation_set_id` , ts.`name` " +
                " FROM `validation_set` ts, `projects` p " +
                " where ts.`project_id` = p.`project_id` and p.`url` = " + mysql.escape(project_url);

        queryHandler(q, callback);
    },
   
    validationsStats: function(project_url,species,songtype, callback) {
        var q = "select * from "+
            " (SELECT count(*) as total FROM `recording_validations` rv,`projects` p  WHERE rv.`project_id` = p.`project_id` and p.`url` = "+mysql.escape(project_url)+" and `species_id` = "+mysql.escape(species)+" and `songtype_id` = "+mysql.escape(songtype)+" ) a, "+
            " (SELECT count(*) as present FROM `recording_validations` rv,`projects` p  WHERE rv.`project_id` = p.`project_id` and p.`url` = "+mysql.escape(project_url)+" and `species_id` = "+mysql.escape(species)+" and `songtype_id` = "+mysql.escape(songtype)+"  and present = 1) b , "+
            " (SELECT count(*) as absent FROM `recording_validations` rv,`projects` p  WHERE rv.`project_id` = p.`project_id` and p.`url` = "+mysql.escape(project_url)+" and `species_id` = "+mysql.escape(species)+"and `songtype_id` = "+mysql.escape(songtype)+"  and present = 0) c ";
        queryHandler(q, callback);
    },
    
    validationsCount: function(project_id, callback) {
        var q = "SELECT count(*) AS count \n"+
                "FROM recording_validations AS rv\n"+
                "WHERE rv.project_id = " + mysql.escape(project_id);
        queryHandler(q, callback);
    },
    
    modelValidationUri: function(model_id, callback)
    {
        var q = "SELECT vs.`uri` FROM `validation_set` vs, `models` m "+
            " WHERE m.`validation_set_id` = vs.`validation_set_id` "+
            " and m.`model_id` = "+ mysql.escape(model_id);
        
        queryHandler(q, callback);      
    },
    activeJobs: function(project_url, callback) {
        var q = "(SELECT j.`progress`,j.`progress_steps`, j.`job_type_id` ,j.`job_id` , " +
                " CONCAT(UCASE(LEFT( jpt.`name`, 1)), SUBSTRING( jpt.`name`, 2)) as name, round(100*(j.`progress`/j.`progress_steps`),1) as percentage "+
                " FROM  `job_params_training` as jpt,`jobs` as j , `projects` as p WHERE j.`project_id` = p.`project_id` and j.`hidden` = 0    "+
                " and jpt.`job_id` = j.`job_id` and j.`job_type_id` = 1 and p.`url` = " + mysql.escape(project_url)+" )"+
                " UNION "+
                " (SELECT j.`progress`,j.`progress_steps`, j.`job_type_id` ,j.`job_id` , "+
                " CONCAT(UCASE(LEFT( jpt.`name`, 1)), SUBSTRING( jpt.`name`, 2)) as name , round(100*(j.`progress`/j.`progress_steps`),1) as percentage "+
                " FROM  `job_params_classification` as jpt,`jobs` as j , `projects` as p WHERE j.`project_id` = p.`project_id` and j.`hidden` = 0   "+
                " and jpt.`job_id` = j.`job_id` and j.`job_type_id` = 2 and p.`url` = " + mysql.escape(project_url)+" )"+
                " UNION "+
                " (SELECT j.`progress`,j.`progress_steps`, j.`job_type_id` ,j.`job_id` , "+
                " CONCAT(UCASE(LEFT( jpt.`name`, 1)), SUBSTRING( jpt.`name`, 2)) as name , round(100*(j.`progress`/j.`progress_steps`),1) as percentage "+
                " FROM  `job_params_soundscape` as jpt,`jobs` as j , `projects` as p WHERE j.`project_id` = p.`project_id` and j.`hidden` = 0   "+
                " and jpt.`job_id` = j.`job_id` and j.`job_type_id` = 4 and p.`url` = " + mysql.escape(project_url)+" )";              
        queryHandler(q, callback);
    },
    
    
    removeUser: function(user_id, project_id, callback){
        if(typeof project_id !== 'number')
            return callback(new Error("invalid type for 'project_id'"));
        
        if(typeof user_id !== 'number')
            return callback(new Error("invalid type for 'user_id'"));
        
        var q = "DELETE FROM user_project_role \n"+
                "WHERE user_id = %s AND project_id = %s";
        
        q = util.format(q, mysql.escape(user_id), mysql.escape(project_id));
        queryHandler(q, callback);
    },
    
    availableRoles: function(callback) {
        var q = "SELECT role_id as id, name, description \n"+
                "FROM roles \n"+
                "WHERE name != 'Owner' order by level";
                
        queryHandler(q, callback);
    },
    
    // this includes recordings processing
    totalRecordings: function(project_id, callback) {
        var q = "SELECT count(*) as count \n"+
                "FROM ( \n"+
                "        (SELECT upload_id as id \n"+
                "        FROM uploads_processing  \n"+
                "        WHERE project_id = %1$s) \n"+
                "        UNION \n"+
                "        (SELECT recording_id as id \n"+
                "        FROM recordings AS r \n"+
                "        JOIN sites AS s ON s.site_id = r.site_id \n"+
                "        WHERE s.project_id = %1$s) \n"+
                "    ) as t";
        
        q = sprintf(q, project_id);
        queryHandler(q, callback);
    }
};


module.exports = Projects;
