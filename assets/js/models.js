(function(angular) {
    var models = angular.module('models', [
        'ngTable',
        'ui.bootstrap',
        'a2services',
        'ui.select',
        'ngSanitize',
        'ngCsv',
        'a2utils',
        'humane'
    ]);
    var template_root = '/partials/models/';
    var amazons3 = "https://s3.amazonaws.com/arbimon2/";

    models.
    controller('ModelsCtrl',
            function($scope, $http, $modal, $filter, $sce, ngTableParams, Project, JobsData, $location) {
                $scope.infoInfo = "Loading...";
                $scope.showInfo = true;
                $scope.loading = true;
                $scope.updateFlags = function() {
                    $scope.successInfo = "";
                    $scope.showSuccess = false;
                    $scope.errorInfo = "";
                    $scope.showError = false;
                    $scope.infoInfo = "";
                    $scope.showInfo = false;
                    $scope.loading = false;
                };

                var pid = -1;
                var p = Project.getInfo(
                    function(data) {
                        $scope.projectData = data;
                        pid = data.project_id;
                        $http.get('/api/project/' + data.url + '/models')
                            .success(
                                function(data) {
                                    $scope.modelsData = data;
                                    $scope.modelsDataOrig = data;
                                    $scope.infopanedata = "";
                                    $scope.successInfo = "";
                                    $scope.showSuccess = false;
                                    $scope.errorInfo = "";
                                    $scope.showError = false;
                                    $scope.infoInfo = "";
                                    $scope.showInfo = false;
                                    $scope.loading = false;
                                    if (data.length > 0) {
                                        $scope.tableParams = new ngTableParams({
                                            page: 1,
                                            count: 10,
                                            filter: {

                                            },
                                            sorting: {
                                                mname: 'asc'
                                            }
                                        }, 
                                        {
                                            total: $scope.modelsDataOrig.length,
                                            getData: function($defer, params) {
                                                $scope.infopanedata = "";
                                                var filteredData = params.filter() ?
                                                    $filter('filter')($scope.modelsDataOrig, params.filter()) :
                                                    $scope.modelsDataOrig;

                                                var orderedData = params.sorting() ?
                                                    $filter('orderBy')(filteredData, params.orderBy()) :
                                                    filteredData;

                                                params.total(orderedData.length);
                                                $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));
                                                if (orderedData.length < 1) {
                                                    $scope.infopanedata = "No models found.";
                                                }
                                                $scope.modelsData = orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
                                            }
                                        });
                                    } 
                                    else {
                                        $scope.infopanedata = "No models found.";
                                    }
                                }
                            )
                            .error(
                                function() {
                                    $scope.errorInfo = "Error Communicating With Server";
                                    $scope.showError = true;
                                    $("#errorDiv").fadeTo(3000, 500).slideUp(500,
                                        function() {
                                            $scope.showError = false;
                                        });
                                }
                            );
                    }
                );

                $scope.newClassification =
                    function(model_id, model_name) {
                        var modalInstance = $modal.open({
                            templateUrl: template_root + 'newclassification.html',
                            controller: 'NewClassificationInstanceCtrl',
                            resolve: {
                                model_name: function() {
                                    return model_name;
                                },
                                model_id: function() {
                                    return model_id;
                                }
                            }
                        });

                        modalInstance.result.then(
                            function() {
                                console.log('new classification: ' + new Date());
                            }
                        );
                    };

                $scope.deleteModel =
                    function(model_id, model_name) {
                        $scope.infoInfo = "Loading...";
                        $scope.showInfo = true;
                        $scope.loading = true;
                        var modalInstance = $modal.open({
                            templateUrl: template_root + 'deletemodel.html',
                            controller: 'DeleteModelInstanceCtrl',
                            resolve: {
                                model_name: function() {
                                    return model_name;
                                },
                                model_id: function() {
                                    return model_id;
                                },
                                projectData: function() {
                                    return $scope.projectData;
                                }
                            }
                        });

                        modalInstance.opened.then(function() {
                            $scope.infoInfo = "";
                            $scope.showInfo = false;
                            $scope.loading = false;
                        });

                        modalInstance.result.then(
                            function() {
                                var index = -1;
                                var modArr = eval($scope.modelsDataOrig);
                                for (var i = 0; i < modArr.length; i++) {
                                    if (modArr[i].model_id === model_id) {
                                        index = i;
                                        break;
                                    }
                                }
                                if (index > -1) {
                                    $scope.modelsDataOrig.splice(index, 1);
                                    $scope.tableParams.reload();
                                    $scope.successInfo = "Model Deleted Successfully";
                                    $scope.showSuccess = true;
                                    $("#successDiv").fadeTo(3000, 500).slideUp(500,
                                        function() {
                                            $scope.showSuccess = false;
                                        });
                                }
                            }
                        );
                    };
                $scope.model_id = null;
                $scope.validationdata = null;
                
                $scope.newModel =
                    function() {
                        $scope.infoInfo = "Loading...";
                        $scope.showInfo = true;
                        $scope.loading = true;
                        var url = $scope.projectData.url;
                        $http.get('/api/project/' + url + '/models/forminfo')
                            .success(
                                function(data) {

                                    var modalInstance = $modal.open({
                                        templateUrl: template_root + 'newmodel.html',
                                        controller: 'NewModelInstanceCtrl',
                                        resolve: {
                                            projectData: function() {
                                                return $scope.projectData;
                                            },
                                            types: function() {
                                                return data.types;
                                            },
                                            trainings: function() {
                                                return data.trainings;
                                            }
                                        }
                                    });
                                    modalInstance.opened.then(function() {
                                        $scope.infoInfo = "";
                                        $scope.showInfo = false;
                                        $scope.loading = false;
                                    });

                                    modalInstance.result.then(
                                        function(result) {
                                            data = result;
                                            if (data.ok) {
                                                JobsData.updateJobs();
                                                $scope.successInfo = "New Model Training on Queue";
                                                $scope.showSuccess = true;
                                                $("#successDiv").fadeTo(3000, 500).slideUp(500,
                                                    function() {
                                                        $scope.showSuccess = false;
                                                    });
                                            }

                                            if (data.err) {
                                                $scope.errorInfo = "Error Creating Training Job";
                                                $scope.showError = true;
                                                $("#errorDiv").fadeTo(3000, 500).slideUp(500,
                                                    function() {
                                                        $scope.showError = false;
                                                    });
                                            }

                                            if (data.url) {
                                                $location.path(data.url);
                                            }
                                        }
                                    );
                                }
                            ).error(
                                function() {
                                    $scope.errorInfo = "Error Communicating With Server";
                                    $scope.showError = true;
                                    $("#errorDiv").fadeTo(3000, 500).slideUp(500,
                                        function() {
                                            $scope.showError = false;
                                        });
                                }
                            );

                    };

            }
        )
        .controller('NewModelInstanceCtrl',
            function($scope, $modalInstance, $http, projectData, types, trainings) {
                $scope.types = types;
                $scope.projectData = projectData;
                $scope.trainings = trainings;
                $scope.nameMsg = '';
                $scope.data = {
                    training: '',
                    classifier: '',
                    name: '',
                    totalValidations: 'Retrieving...',
                    presentValidations: '-',
                    absentsValidations: '-',
                    usePresentTraining: '',
                    useNotPresentTraining: '',
                    usePresentValidation: -1,
                    useNotPresentValidation: -1
                };

                $scope.$watch('data.usePresentTraining',
                    function() {
                        var val = $scope.data.presentValidations - $scope.data.usePresentTraining;

                        if (val > -1) {
                            $scope.data.usePresentValidation = val;
                        } else {
                            $scope.data.usePresentValidation = 0;
                        }

                        if ($scope.data.usePresentTraining > $scope.data.presentValidations) {
                            $scope.data.usePresentTraining = $scope.data.presentValidations;
                        }

                    });

                $scope.$watch('data.useNotPresentTraining',
                    function() {
                        var val = $scope.data.absentsValidations - $scope.data.useNotPresentTraining;
                        if (val > -1) {
                            $scope.data.useNotPresentValidation = val;
                        } else
                            $scope.data.useNotPresentValidation = 0;

                        if ($scope.data.useNotPresentTraining > $scope.data.absentsValidations)
                            $scope.data.useNotPresentTraining = $scope.data.absentsValidations;

                    });

                $scope.$watch('data.training',
                    function() {
                        if ($scope.data.training !== '') {
                            $http.get('/api/project/' + $scope.projectData.url + '/validations/' + $scope.data.training.species_id + "/" + $scope.data.training.songtype_id)
                                .success(
                                    function(data) {
                                        $scope.data.totalValidations = data[0].total;
                                        $scope.data.presentValidations = data[0].present;
                                        $scope.data.absentsValidations = data[0].absent;
                                    }
                                ).error(
                                    function() {
                                        $scope.errorInfo = "Error Communicating With Server";
                                        $scope.showError = true;
                                        $("#errorDiv").fadeTo(3000, 500).slideUp(500,
                                            function() {
                                                $scope.showError = false;
                                            });
                                    }
                                );
                        }
                    });

                $scope.buttonEnable = function() {
                    return !($scope.trainings.length && $scope.data.name.length && $scope.data.usePresentTraining > 0 && $scope.data.useNotPresentTraining > 0 && $scope.data.usePresentValidation > 0 && $scope.data.useNotPresentValidation > 0 && !((typeof $scope.data.training) == 'string') && !((typeof $scope.data.classifier) == 'string'));
                };

                $scope.ok = function() {
                    var url = $scope.projectData.url;
                    $scope.nameMsg = '';
                    $http.post('/api/project/' + url + '/models/new', {
                        n: $scope.data.name,
                        t: $scope.data.training.training_set_id,
                        c: $scope.data.classifier.model_type_id,
                        tp: $scope.data.usePresentTraining,
                        tn: $scope.data.useNotPresentTraining,
                        vp: $scope.data.usePresentValidation,
                        vn: $scope.data.useNotPresentValidation
                    }).
                    success
                        (
                            function(data, status, headers, config) {
                                if (data.name) {
                                    $scope.nameMsg = 'Name exists';
                                } else $modalInstance.close(data);
                            }
                        ).
                    error(
                        function(data, status, headers, config) {
                            $modalInstance.close({
                                err: "Cannot create job"
                            });
                        }
                    );

                };

                $scope.cancel = function(url) {
                    $modalInstance.close({
                        url: url
                    });
                };

            }
        )
        .controller('DeleteModelInstanceCtrl',
            function($scope, $modalInstance, $http, model_name, model_id, projectData) {
                $scope.model_name = model_name;
                $scope.model_id = model_id;
                $scope.projectData = projectData;
                var url = $scope.projectData.url;
                $scope.ok = function() {
                    $http.get('/api/project/' + url + '/models/' + model_id + "/delete")
                        .success(
                            function(data) {
                                $modalInstance.close();
                            }
                        ).error(
                            function() {
                                $scope.errorInfo = "Error Communicating With Server";
                                $scope.showError = true;
                                $("#errorDiv").fadeTo(3000, 500).slideUp(500,
                                    function() {
                                        $scope.showError = false;
                                    });
                            }
                        );

                };

                $scope.cancel = function() {
                    $modalInstance.dismiss('cancel');
                };

            }
        )
        .controller('NewClassificationInstanceCtrl',
            function($scope, $modalInstance, model_name, model_id) {
                $scope.model_name = model_name;
                $scope.model_id = model_id;
                $scope.ok = function() {
                    $modalInstance.close();
                };

                $scope.cancel = function() {
                    $modalInstance.dismiss('cancel');
                };

            }
        )
        .controller('ModelDetailsCtrl', function($scope, $http, $stateParams, $location, Project, notify) {
            
            var project_url = Project.getName();
            
            $scope.infoInfo = "Loading...";
            $scope.showInfo = true;
            $scope.loading = true;
                            
            $http.get('/api/project/' + project_url + '/validation/list/' + $stateParams.modelId)
            .success(function(vdata) {
                $scope.validations = vdata;
                $scope.valiDetails = $scope.validations.nofile ? false : true;
                
            })
            .error(function() {
                notify.error("Error Communicating With Server");
            });
            
            $http.get('/api/project/' + project_url + '/models/' + $stateParams.modelId)
            .success(function(data) {
                $scope.data = {
                    modelmdc: data.mdc, //ok
                    modelmtime: data.mtime, //ok
                    modelmname: data.mname, //ok
                    modelmtname: data.mtname, //ok
                    modelmuser: data.muser, //ok
                    modelmodel_id: data.model_id, //ok
                    png: data.json.roiUrl, //ok
                    lasttime: data.lasttime, //ok
                    lastupdate: data.lastupdate, //ok
                    remarks: data.remarks,
                    songtype: data.songtype, //ok
                    species: data.species, //ok
                    trainingName: data.trainingSetName, //ok
                    trainingDate: data.trainingSetdcreated, //ok
                    trainingTime: data.trainingSettime, //ok
                    all: data.use_in_training_present + data.use_in_validation_present + data.use_in_training_notpresent + data.use_in_validation_notpresent, //ok
                    p: data.use_in_training_present + data.use_in_validation_present, //ok
                    np: data.use_in_training_notpresent + data.use_in_validation_notpresent, //ok
                    tnp: data.use_in_training_notpresent, //ok
                    tp: data.use_in_training_present, //ok
                    vnp: data.use_in_validation_notpresent, //ok
                    vp: data.use_in_validation_present, //ok
                    accuracy: Math.round(data.json.accuracy * 100) / 100, //ok
                    oob: Math.round(data.json.forestoobscore * 100) / 100, //ok
                    precision: Math.round(data.json.precision * 100) / 100, //ok
                    sensitivity: data.json.sensitivity !== null ? Math.round(data.json.sensitivity * 100) / 100 : null, //ok
                    specificity: data.json.specificity !== null ? Math.round(data.json.specificity * 100) / 100 : null, //ok
                    tpos: data.json.tp,
                    fpos: data.json.fp,
                    tneg: data.json.tn,
                    fneg: data.json.fn,
                    roicount: data.json.roicount, //ok
                    hfreq: Math.round(data.json.roihighfreq * 100) / 100, //ok
                    lfreq: Math.round(data.json.roilowfreq * 100) / 100, //ok
                    rlength: Math.round(data.json.roilength * 100) / 100, //ok
                    bw: Math.round(((parseFloat(data.json.roihighfreq) - parseFloat(data.json.roilowfreq)) * 100)) / 100,
                    freqMax: data.json.roisamplerate / 2, //ok
                };
            })
            .error(function() {
                notify.error("Error Communicating With Server");
            });
            
            
        
            $scope.getValidations = function() {
                var vals = [];
                for (var i = 0; i < $scope.validations.length; i++) {
                    vals.push({
                        site: $scope.validations[i].site,
                        date: $scope.validations[i].date,
                        user: $scope.validations[i].presence,
                        model: $scope.validations[i].model
                    });
                }
                return vals;
            };

            $scope.savedhtml = '';


            $scope.gotoRec = function(rec) {
                
                var selected = rec;
                var rurl = "/project/" + project_url + "/#/visualizer/rec/" + selected.id;
                $location.path(rurl);
            };

            $scope.fields = [{
                name: 'Date',
                key: 'date'
            }, {
                name: 'Site',
                key: 'site'
            }, {
                name: 'User presence',
                key: 'presence'
            }, {
                name: 'Model presence',
                key: 'model'
            }];

            
            $scope.validationRows = null;

        });
})(angular);
