var util = require('util');
var validator = require('validator');

module.exports = function(queryHandler) {
    return {
        isValidUrl : function (project_url,callback)
	{
		var query = "select * from projects where url = '"+validator.escape(project_url)+"'";

		return queryHandler(query , callback);
	}
    };
}
    
