
(function(angular){ 
    var jobs = angular.module('jobs',['a2services', 'a2-job-data', 'a2-job-type']);
    
    jobs.config(['$stateProvider', function($stateProvider) {
        $stateProvider.state('jobs', {
            url: '/jobs',
            controller : 'StatusBarNavController' ,
            templateUrl: '/partials/jobs/index.html'
        });
    }]);
    
    angular.module('a2-job-data',['a2services'])
    .service('JobsData', function ($http, $interval, Project, $q){
        var jobslength = 0;
        var jobs=[];
        var job_types;
        var url = Project.getName();
        var intervalPromise;
        // $http.get('/api/project/'+url+'/progress').success(function(data) {
        //     jobs = data;
        //     jobslength = jobs.length;
        // });
                    
        return {
                geturl : function(){
                    return url;  
                },
                getjobLength: function() {
                    return jobslength;
                },
                getJobs: function() {
                    return jobs;
                },
                getJobTypes: function(){
                    var d = $q.defer();
                    if(job_types){
                        d.resolve(job_types);
                    } else{
                        $http.get('/api/job/types')
                        .success(function(_job_types){
                            job_types = _job_types;
                            d.resolve(job_types);
                        })
                        .error(function(){
                            d.reject("Could not retrieve job types.");
                        });
                    }
                    return d.promise;
                },
                updateJobs: function(){
                    $http.get('/api/project/'+url+'/progress').success(function(data){
                        jobs = data;
                        jobslength = jobs.length;
                    });
                },
                startTimer : function(){
                    $interval.cancel(intervalPromise);
                    if (typeof jobs != 'undefined' && jobs.length>0) {
                        intervalPromise = 
                        $interval(function(){
                            var cancelInterval = true;
                            for(var i =0;i < jobs.length ; i++)
                            {
                                if (jobs[i].percentage < 100)
                                {
                                    cancelInterval = false;
                                    break;
                                }
                            }
                            if (cancelInterval) {
                                $interval.cancel(intervalPromise);
                            }
                            else if ( jobs.length < 1) {
                                $interval.cancel(intervalPromise);
                            }else
                                $http.get('/api/project/'+url+'/progress')
                                .success
                                (
                                    function(data) 
                                    {
                                        jobs = data;
                                        jobslength = jobs.length;
                                     }
                                );
                        },1000);
                    }
                    
                },
                cancelTimer : function(){
                    $interval.cancel(intervalPromise);                   
                }
            };
                
        }
    );
    
    jobs.controller('StatusBarNavIndexController',
        function ($scope, $http, $timeout,JobsData)          
        {
            $scope.$watch
            (
             function(){
                return JobsData.getjobLength();
                }
                ,
                function()
                {
                    $scope.jobslength  = JobsData.getjobLength();
                    
                }
            );
        }         
    );

    angular.module('a2-job-types',['a2-job-data'])
    .controller('JobTypesController', function(JobsData){
        var self = this;
        JobsData.getJobTypes().then(function(job_types){
            var colors = ['blue','red','green','purple','orange'];
            self.types = job_types;
            self.show  = {};
            self.for   = {};
            self.types.forEach(function(c,i){
                self.show[c.id] = true;
                self.for[c.id] = c;
                c.color = colors[i % colors.length];
            });
        });
    });
    

   jobs.controller
    ('UnfinishedJobInstanceCtrl', 
        function ($scope, $modalInstance) 
        {

            $scope.ok = function () {
                $modalInstance.close( {"ok":"delete"}  );
            };

            $scope.cancel = function () {
                 $modalInstance.dismiss('cancel');
            };

        }
    ) ;
    
    
    jobs.controller('StatusBarNavController', function ($scope, $http,$modal,$interval, Project, JobsData){
        $scope.show={};
        $scope.showClassifications = true;
        $scope.showTrainings = true;
	    $scope.showSoundscapes = true;
        $scope.url = '';
        $scope.successInfo = "";
        $scope.showSuccesss = false;
        $scope.errorInfo = "";
        $scope.showErrors = false;
        $scope.infoInfo = "Loading...";
        $scope.showInfo = true;
        $scope.updateFlags = function(){
    		$scope.successInfo = "";
    		$scope.showSuccess = false;
    		$scope.errorInfo = "";
    		$scope.showError = false;
    		$scope.infoInfo = "";
    		$scope.showInfo = false;
        };
        $scope.jobs = [];
        $scope.$watch(
            function(){
                return JobsData.getJobs();
            },
            function(new_jobs){
                $scope.jobs = new_jobs;
                JobsData.startTimer();
                $scope.infoInfo = "";
                $scope.showInfo = false;
            }
        );
        
        $scope.$on('$destroy', function () { JobsData.cancelTimer(); });
        
        $scope.hideJob = function(jobId){
            $scope.infoInfo = "Loading...";
            $scope.showInfo = true;
            var continueFalg = true;
            for(var i =0;i < $scope.jobs.length ; i++){
                if ($scope.jobs[i].job_id == jobId) {
                    if ($scope.jobs[i].percentage < 100){
                        continueFalg = false;
                        var modalInstance = $modal.open({
                            template: '<div class="modal-header">'  +
                                            '<h3 class="modal-title">Hide running job</h3> '+ 
                                        '</div>  '+
                                        '<div class="modal-body"> '+
                                        'Job has not finished. Hide anyway?'+
                                        '</div>  '+
                                        '<div class="modal-footer">  '+
                                            '<button class="btn btn-primary" ng-click="ok()">Submit</button>  '+
                                            '<button class="btn btn-warning" ng-click="cancel()">Cancel</button>  '+
                                        '</div>  ',
                            controller: 'UnfinishedJobInstanceCtrl',
                        });
                        
                        modalInstance.opened.then(function(){
                            $scope.infoInfo = "";
                            $scope.showInfo = false;    
                        });
                        
                        modalInstance.result.then(function (data) {
                            if(data.ok){
                                $http.get('/api/project/'+JobsData.geturl()+'/job/hide/'+jobId)
                                .success(
                                    function(data) {
                                        if (data.err){
                                            $scope.errorInfo = "Error Communicating With Server";
                                            $scope.showError = true;
                                            $("#errorDiv").fadeTo(3000, 500).slideUp(500, function(){
                                                $scope.showError = false;
                                            });
                                        } else {
                                            JobsData.updateJobs();
                                            $scope.successInfo = "Job Hidden Successfully";
                                            $scope.showSuccesss = true;
                                            $("#successDivs").fadeTo(3000, 500).slideUp(500, function(){
                                                $scope.showSuccesss = false;
                                            });
                                        }
                                     }
                                )
                                .error(function(){
                                    $scope.errorInfo = "Error Communicating With Server";
                                    $scope.showError = true;
                                    $("#errorDiv").fadeTo(3000, 500).slideUp(500,
                                    function(){
                                        $scope.showError = false;
                                    });
                                });
                            }
                        });
                    }
                }
            }
            
            if (continueFalg){
                $http.get('/api/project/'+JobsData.geturl()+'/job/hide/'+jobId)
                .success(function(data) {
                    if (data.err){
                        $scope.errorInfo = "Error Communicating With Server";
                        $scope.showError = true;
                        $("#errorDiv").fadeTo(3000, 500).slideUp(500, function(){
                            $scope.showError = false;
                        });
                    } else {
                        JobsData.updateJobs();
                        $scope.successInfo = "Job Hidden Successfully";
                        $scope.showSuccesss = true;
                        $("#successDivs").fadeTo(3000, 500).slideUp(500, function(){
                            $scope.showSuccesss = false;
                        });
                    }
                })
                .error(function(){
                    $scope.errorInfo = "Error Communicating With Server";
                    $scope.showError = true;
                    $("#errorDiv").fadeTo(3000, 500).slideUp(500, function(){
                        $scope.showError = false;
                    });
                });
            }
        };
    });   
}
)(angular);
