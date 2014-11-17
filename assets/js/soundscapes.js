(function(angular)
{ 
    var soundscapes = angular.module('soundscapes', ['ui.bootstrap' , 'a2services']);
    var template_root = '/partials/soundscapes/';

    soundscapes.controller
    ('SoundscapesCtrl' , 
        function ($scope,$http,$modal,$filter,$sce) 
        {
	    console.log('SoundscapesCtrl' )
	    $scope.successInfo = "";
	    $scope.showSuccess = false;
	    $scope.errorInfo = "";
	    $scope.showError = false;
	    $scope.infoInfo = "";
	    $scope.showInfo = false;
	    $scope.infopanedata = '';
	}
    )
    .directive
    ('a2Soundscapes',
        function()
        {
            return  {restrict : 'E', templateUrl: template_root + 'main.html'} 

        }
    ).directive
    ('a2Soundscapelist',
        function()
        {
            return  {restrict : 'E',
                    templateUrl: template_root + 'soundscapelist.html'} 

        }
    );
}
)(angular);
