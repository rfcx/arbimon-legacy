(function(angular)
{ 
    var analysis = angular.module('analysis',[ 'models','classification','soundscapes']);
    var template_root = '/partials/analysis/';
    var amazons3 = "https://s3.amazonaws.com/arbimon2/";
    analysis
    .config(function($stateProvider, $urlRouterProvider) {
	var analysisHistory = [];
	var analysisVisited = false;
	 $urlRouterProvider
	 .rule(  
	    function ($injector, $location , $state)
	    {
		 var m, path = $location.path();
     
		 if(m=/analysis\/?(.*)/.exec(path))
		 {
		     analysisVisited  = true;
		     
		     if (analysisHistory.length==2)
		     {
			 var loc0 = analysisHistory[0].split('/');
			 var loc1 = analysisHistory[1].split('/');
			 if(loc0[1] != loc1[1])
			 {
			     analysisHistory.pop()
			     $location.replace().path(analysisHistory[0]); 
			 }
			 else
			 {
			     analysisHistory.pop()
			     analysisHistory.pop()
			     if (path != "")
				 analysisHistory.push(path)  
			 }
		     }
		     else
		     {
			 analysisHistory.pop()
			 if (path != "")
			     analysisHistory.push(path)
		     }
		 }
		 else if (analysisVisited)
		 {
		     if(analysisHistory.length==2)
		     {
			 analysisHistory.pop()
			 if (path != "")
			     analysisHistory.push(path)
		     }
		     else
		     {
			 if (path != "")
			     analysisHistory.push(path)
		     }
		 }
	    }
	 )
	 .when("/analysis", "/analysis/models");
     
	 $stateProvider.state('analysis.models', {
	     url: '/models',
	     template: '<a2-models></a2-models>'
	 })
	 .state('analysis.classification', {
	     url: '/classification',
	     template: '<a2-classification></a2-classification>'
	 })
	 .state('analysis.soundscapes', {
	     url: '/soundscapes',
	     template: '<a2-soundscapes></a2-soundscapes>'
	 });
     });
}
)(angular);

