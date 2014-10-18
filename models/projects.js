var util = require('util');
var mysql = require('mysql');

module.exports = function(queryHandler) {
    return {
        findByUrl: function (project_url, callback) {
            var query = "SELECT * FROM projects WHERE url = " + mysql.escape(project_url);
            
            return queryHandler(query , callback);
        },
        
        findByName: function (project_name, callback) {
            var query = "SELECT * FROM projects WHERE name = " + mysql.escape(project_name);
            
            return queryHandler(query , callback);
        },
        
        getProjectSites: function(project_id, callback){
            var query = (
                "SELECT S.site_id as id, S.name, S.lat, S.lon, S.alt \n" +
                "FROM sites S \n" +
                "WHERE S.project_id = " + mysql.escape(project_id)
            );
            
            return queryHandler(query , callback);
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
            
            for( var i in project) {
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
            var values = [];
            
            if(typeof project["project_id"] === "undefined")
                return callback(new Error("required field 'project_id' missing"));
            
            for( var i in project) {
                if(i !== 'project_id') {
                    project[i] = mysql.escape(project[i]);
                    values.push(util.format('`%s`=%s', i, project[i]));
                }
            }
            
            var q = 'UPDATE projects \n'+
                    'SET %s \n'+
                    'WHERE site_id = %s';
                    
            q = util.format(q, values.join(", "), project.site_id);
            
            queryHandler(q, callback);
        },
        
        addUser: function(row, callback) {
            
            var user_id = mysql.escape(row.user_id);
            var project_id = mysql.escape(row.project_id);
            var role_id = mysql.escape(row.role_id);
            
            var q = 'INSERT INTO user_project_role \n'+
                    'SET user_id = %s, role_id = %s, project_id = %s';
            
            q = util.format(q, user_id, role_id, project_id);
            queryHandler(q, callback);
        },
        
        insertNews: function(news) {
            var user_id = mysql.escape(news.user_id);
            var project_id = mysql.escape(news.project_id);
            var description = mysql.escape(news.description);
            var news_type_id = mysql.escape(news.news_type_id);
            
            var q = 'INSERT INTO project_news \n'+
                    'SET user_id = %s, '+ 
                    'project_id = %s, '+
                    'description = %s, '+
                    'news_type_id = %s';
            
            q = util.format(q, user_id, project_id, description, news_type_id);
            queryHandler(q, function(err) {
                if(err) throw err;
            });
        },

        modelList: function(project_url, callback) {
            var q = "SELECT m.model_id, CONCAT(UCASE(LEFT(m.name, 1)), SUBSTRING(m.name, 2)) as mname "+
                    " ,DATE_FORMAT(m.date_created,'%d-%m-%Y') as mdc "+
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
            var q = "SELECT DATE_FORMAT(j.`date_created`,'%d-%m-%Y') as date  , j.`job_id`  , "+
                    " CONCAT(UCASE(LEFT(jpc.`name`, 1)), SUBSTRING(jpc.`name`, 2))  as cname  "+
                    " , CONCAT(CONCAT(UCASE(LEFT(u.firstname, 1)), SUBSTRING(u.firstname, 2)) ,"+
                    "  ' ', CONCAT(UCASE(LEFT(u.lastname, 1)), SUBSTRING(u.lastname, 2)) ) as muser " + 
                    " from `jobs` as j ,`job_params_classification` as jpc , `projects` as p , `users` as u "+
                    " WHERE p.url  = "+mysql.escape(project_url)+" and j.`project_id` = p.`project_id`  and "+
                    " j.`job_id` = jpc.`job_id` and j.`job_type_id` = 2 and j.`completed` = 1 and u.`user_id` = j.`user_id`";

            queryHandler(q, callback);
       },
       
       classificationDetail: function(project_url,cid, callback) {
            var q = "select  c.`species_id` ,c.`songtype_id`,c.`present`  , "+
                    " CONCAT(UCASE(LEFT(st.`songtype`, 1)), SUBSTRING(st.`songtype`, 2)) as songtype , "+
                    " CONCAT(UCASE(LEFT(s.`scientific_name`, 1)), SUBSTRING(s.`scientific_name`, 2)) as scientific_name  "+
                    " from  `classification_results` c,`species` as s , `songtypes` as st where c.`job_id` = "+cid+
                    " and c.`species_id` = s.`species_id` and c.`songtype_id` = st.`songtype_id`" ;

            queryHandler(q, callback);
       },
       
       trainingSets: function(project_url, callback) {
            var q = "SELECT ts.`training_set_id` , CONCAT(UCASE(LEFT(ts.`name`, 1)), SUBSTRING(ts.`name`, 2)) as name "+
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
       }
       ,
       
       activeJobs: function(project_url, callback) {
            var q = "(SELECT j.`progress`,j.`progress_steps`, j.`job_type_id` ,j.`job_id` ,jpt.`name`, 100*(j.`progress`/j.`progress_steps`) as percentage "+
                    " FROM  `job_params_training` as jpt,`jobs` as j , `projects` as p WHERE j.`project_id` = p.`project_id` and j.`hidden` = 0  "+
                    " and jpt.`job_id` = j.`job_id` and j.`job_type_id` = 1 and p.`url` = " + mysql.escape(project_url)+" )"+
                    " UNION "+
                    " (SELECT j.`progress`,j.`progress_steps`, j.`job_type_id` ,j.`job_id` ,jpt.`name` , 100*(j.`progress`/j.`progress_steps`) as percentage "+
                    " FROM  `job_params_classification` as jpt,`jobs` as j , `projects` as p WHERE j.`project_id` = p.`project_id` and j.`hidden` = 0  "+
                    " and jpt.`job_id` = j.`job_id` and j.`job_type_id` = 2 and p.`url` = " + mysql.escape(project_url)+" )";
                    
            queryHandler(q, callback);
       }
    };
}
    
