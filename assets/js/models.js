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

    models.controller('ModelsCtrl', 
        function($scope, $modal, $filter, ngTableParams, Project, a2Models, JobsData, $location, notify) {
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

            Project.getInfo(function(data) {
                $scope.projectData = data;
            });

            var initTable = function(p,c,s,f,t) {
                var sortBy = {};
                var acsDesc = 'desc';
                if (s[0]=='+') {
                    acsDesc = 'asc';
                }
                sortBy[s.substring(1)] = acsDesc;
                $scope.tableParams = new ngTableParams({
                    page: p,
                    count: c,
                    sorting: sortBy,
                    filter:f
                }, {
                    total: t,
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
                        a2Models.saveState({
                            data: $scope.modelsDataOrig,
                            filtered: $scope.modelsData,
                            f: params.filter(),
                            o: params.orderBy(),
                            p: params.page(),
                            c: params.count(),
                            t: orderedData.length
                        });
                    }
                });
            };
            
            $scope.loadModels = function() {
                a2Models.list(function(data) {
                    $scope.modelsData = data;
                    $scope.modelsDataOrig = data;
                    $scope.showInfo = false;
                    $scope.loading = false;

                    if (data.length > 0) {
                        if (!$scope.tableParams) {
                            initTable(1,10,"+mname",{},data.length);
                        }
                        else {
                            $scope.tableParams.reload();
                        }
                    }
                    else {
                        $scope.infopanedata = "No models found.";
                    }
                });
            };
            
            
            var stateData = a2Models.getState();
            if (stateData === null)
            {
                $scope.loadModels();
            }
            else
            {
                if (stateData.data.length > 0) {
                    $scope.modelsData = stateData.filtered;
                    $scope.modelsDataOrig = stateData.data;
                    initTable(stateData.p,stateData.c,stateData.o[0],stateData.f,stateData.filtered.length);
                }
                else {
                    $scope.infopanedata = "No models found.";
                }            
                $scope.infoInfo = "";
                $scope.showInfo = false;
                $scope.loading = false;
            }
                        
            $scope.newClassification = function(model_id, model_name) {

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
                        //console.log('new classification: ' + new Date());
                    }
                );
            };


            $scope.deleteModel = function(model_id, model_name) {
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
                    function(ret) {
                        if (ret.error) {
                            notify.error("Error: "+ret.error);
                        }
                        else
                        {
                            var index = -1;
                            var modArr = angular.copy($scope.modelsDataOrig);
                            for (var i = 0; i < modArr.length; i++) {
                                if (modArr[i].model_id === model_id) {
                                    index = i;
                                    break;
                                }
                            }
                            if (index > -1) {
                                $scope.modelsDataOrig.splice(index, 1);
                                $scope.tableParams.reload();
                                notify.log("Model deleted successfully");
                            }
                        }
                    }
                );
            };


            $scope.model_id = null;
            $scope.validationdata = null;

            $scope.newModel = function() {
                $scope.infoInfo = "Loading...";
                $scope.showInfo = true;
                $scope.loading = true;
                var url = $scope.projectData.url;
                a2Models.getFormInfo(function(data) {

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
                                notify.log("Your new model training is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
                            }

                            if (data.error) {
                                notify.error("Error: "+data.error);
                            }

                            if (data.url) {
                                $location.path(data.url);
                            }
                        }
                    );
                });
            };
        }
    )
    .controller('NewModelInstanceCtrl', 
        function($scope, $modalInstance, a2Models, Project, projectData, types, trainings, notify) {
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

            $scope.$watch('data.usePresentTraining', function() {
                var val = $scope.data.presentValidations - $scope.data.usePresentTraining;

                if (val > -1) {
                    $scope.data.usePresentValidation = val;
                }
                else {
                    $scope.data.usePresentValidation = 0;
                }

                if ($scope.data.usePresentTraining > $scope.data.presentValidations) {
                    $scope.data.usePresentTraining = $scope.data.presentValidations;
                }
            });

            $scope.$watch('data.useNotPresentTraining', function() {
                    var val = $scope.data.absentsValidations - $scope.data.useNotPresentTraining;
                    if (val > -1) {
                        $scope.data.useNotPresentValidation = val;
                    }
                    else
                        $scope.data.useNotPresentValidation = 0;

                    if ($scope.data.useNotPresentTraining > $scope.data.absentsValidations)
                        $scope.data.useNotPresentTraining = $scope.data.absentsValidations;

            });

            $scope.$watch('data.training', function() {
                if($scope.data.training !== '') {
                    Project.validationBySpeciesSong(
                        $scope.data.training.species_id, 
                        $scope.data.training.songtype_id,
                        function(data) {
                            $scope.data.totalValidations = data[0].total;
                            $scope.data.presentValidations = data[0].present;
                            $scope.data.absentsValidations = data[0].absent;
                        }
                    );
                }
            });

            $scope.buttonEnable = function() {
                return !($scope.trainings.length &&
                    $scope.data.name.length &&
                    $scope.data.usePresentTraining > 0 &&
                    $scope.data.useNotPresentTraining > 0 &&
                    $scope.data.usePresentValidation > 0 &&
                    $scope.data.useNotPresentValidation > 0 &&
                    typeof $scope.data.training !== 'string' &&
                    typeof $scope.data.classifier !== 'string');
            };

            $scope.ok = function() {
                var url = $scope.projectData.url;
                $scope.nameMsg = '';
                a2Models.create({
                        n: $scope.data.name,
                        t: $scope.data.training.training_set_id,
                        c: $scope.data.classifier.model_type_id,
                        tp: parseInt($scope.data.usePresentTraining),
                        tn: parseInt($scope.data.useNotPresentTraining),
                        vp: parseInt($scope.data.usePresentValidation),
                        vn: parseInt($scope.data.useNotPresentValidation)
                    })
                    .success(function(data) {
                        if (data.name) {
                            $scope.nameMsg = 'Name exists';
                        }
                        else {
                            $modalInstance.close(data);
                        }
                    })
                    .error(function() {
                        $modalInstance.close({
                            err: "Could not create job"
                        });
                    });
            };
            $scope.cancel = function(url) {
                $modalInstance.close({
                    url: url
                });
            };
        }
    )
    .controller('DeleteModelInstanceCtrl', 
        function($scope, $modalInstance, a2Models, model_name, model_id, projectData, notify) {
            $scope.model_name = model_name;
            $scope.model_id = model_id;
            $scope.projectData = projectData;
            var url = $scope.projectData.url;
            $scope.ok = function() {
                a2Models.delete(model_id, function(data) {
                    $modalInstance.close(data);
                });
            };

            $scope.cancel = function() {
                $modalInstance.dismiss('cancel');
            };

        }
    )
    // TODO use popup.html
    .controller('NewClassificationInstanceCtrl', function($scope, $modalInstance, model_name, model_id) {
        $scope.model_name = model_name;
        $scope.model_id = model_id;
        
        $scope.ok = function() {
            $modalInstance.close();
        };

        $scope.cancel = function() {
            $modalInstance.dismiss('cancel');
        };
    })
    .controller('ModelDetailsCtrl', 
        function($scope, a2Models, $stateParams, $location, Project, a2Classi, notify, $window) {
            
            
            var loadingMsgs = [
                'Searching Model',
                'Loading validations',
                'Loading vectors'
            ];
            $scope.loading = loadingMsgs[0];
            $scope.showValidationsTable = true;
            $scope.allYesMax = [];
            $scope.vectorNoMax = -1;
            $scope.loadingValidations = true;
            $scope.showModelValidations = true;
            $scope.messageSaved = '';
            
            a2Models.modelState(true);
            
            Project.getInfo(function(data) {
                $scope.project_id = data.project_id;
            });
            
            $scope.$on("$destroy", function() {
                a2Models.modelState(false);
            });
            
            a2Models.findById($stateParams.modelId)
                .success(function(model) {
                    $scope.model = model;
                    $scope.loading = loadingMsgs[1];
                })
                .error(function(data, status) {
                    if(status == 404) {
                        $scope.notFound = true;
                    }
                    else {
                        notify.serverError();
                    }
                    $scope.loading = null;
                });
            
            a2Models.getValidationResults($stateParams.modelId, function(data) {
                if (data.err) {
                    $scope.showModelValidations = false;
                    $scope.loadingValidations = false;
                    $scope.loading = null;
                    return;
                }
                
                $scope.validations = data;

                $scope.valiDetails = $scope.validations.nofile ? false : true;
                getVectors(0);
                $scope.loading = loadingMsgs[2];
            });
            
            /*
                method recursively get validations vectors and then call waitinFunction()
             */
            var getVectors = function(index) {
                if(index >= $scope.validations.length) return $scope.waitinFunction();
                
                var currRec = $scope.validations[index];
                
                currRec.date = $window.moment(currRec.date, 'MM-DD-YYYY HH:mm');
                
                a2Models.getRecVector($scope.model.id, currRec.id)
                    .success(function(data) {
                        if(!(data.err && data.err == "vector-not-found")) {
                            var vector = data.vector;
                    
                            var vmax = Math.max.apply(null, vector);
                            currRec.vmax = vmax;
                            currRec.vector = vector;
                            
                            if(currRec.presence == 'no') {
                                if($scope.vectorNoMax < vmax) {
                                    $scope.vectorNoMax = vmax;
                                }
                            }
                            else if(currRec.presence == 'yes') {
                                $scope.allYesMax.push(vmax);
                            }
                        }
                        getVectors(++index);
                    });
            };
            
            
            $scope.waitinFunction = function() {
                $scope.loading = null;
                if(!$scope.allYesMax.length) {
                    $scope.showModelValidations = false;
                    $scope.loadingValidations = false;
                }
                
                $scope.allYesMax = $scope.allYesMax.sort();
                
                var index = 0;
                for (var j = 0; j < $scope.allYesMax.length; j++) {
                    if ($scope.allYesMax[j] >= $scope.vectorNoMax) {
                        index = j;
                    }
                }
                
                // NOTE this value is received from the server and overwritten here, maybe this value can be saved
                $scope.model.maxv = Math.max.apply(null, $scope.allYesMax);
                $scope.suggestedThreshold = Math.round($scope.allYesMax[index] * 1000000) / 1000000;
                
                if (typeof $scope.suggestedThreshold === undefined || isNaN($scope.suggestedThreshold)) {
                    $scope.suggestedThreshold = Math.round($scope.allYesMax[0] * 1000000) / 1000000;
                }

                if (typeof $scope.suggestedThreshold === undefined || isNaN($scope.suggestedThreshold)) {
                    $scope.showModelValidations = false;
                }
                else {
                    // TODO optimize this section
                    
                    var searchTh = $scope.suggestedThreshold;
                    var thresholdObject = [];
                    var precisionObject = [];
                    var accuracyObject = [];
                    var sensitivityObject = [];
                    var specificityObject = [];
                    var sumObject = [];
                    var tries = 0;
                    var i, ii, jj;
                    
                    while (searchTh > 0.01 && tries < 15) {
                        for (jj = 0; jj < $scope.validations.length; jj++) {
                            $scope.validations[jj].threshold = ($scope.validations[jj].vmax > searchTh) ? 'yes' : 'no';
                        }
                        $scope.computeStats();
                        thresholdObject.push(searchTh);
                        precisionObject.push($scope.thres.precision);
                        accuracyObject.push($scope.thres.accuracy);
                        sensitivityObject.push($scope.thres.sensitivity);
                        specificityObject.push($scope.thres.specificity);
                        sumObject.push($scope.thres.specificity + $scope.thres.sensitivity + $scope.thres.accuracy + $scope.thres.precision);
                        searchTh = searchTh - 0.001;
                        tries = tries + 1;
                    }
                    
                    var max = sumObject[0];
                    var mindex = 0;
                    for (ii = 1; ii < sumObject.length; ii++) {
                        if (sumObject[ii] > max) {
                            max = sumObject[ii];
                            mindex = ii;
                        }
                    }
                    
                    max = precisionObject[0];

                    for (ii = 0; ii < precisionObject.length; ii++) {
                        if (precisionObject[ii] >= max) {
                            max = precisionObject[ii];
                        }
                    }

                    var precisionMaxIndices = [];
                    for (ii = 0; ii < precisionObject.length; ii++) {
                        if (precisionObject[ii] == max) {
                            precisionMaxIndices.push(ii);
                        }
                    }
                    
                    max = sensitivityObject[precisionMaxIndices[0]];

                    for (i = 0; i < precisionMaxIndices.length; i++) {
                        if (sensitivityObject[precisionMaxIndices[i]] >= max) {
                            max = sensitivityObject[precisionMaxIndices[i]];
                        }
                    }

                    var sensitivityMaxIndices = [];
                    for (i = 0; i < precisionMaxIndices.length; i++) {
                        if (sensitivityObject[precisionMaxIndices[i]] == max) {
                            sensitivityMaxIndices.push(precisionMaxIndices[i]);
                        }
                    }
                    max = accuracyObject[sensitivityMaxIndices[0]];

                    for (i = 0; i < sensitivityMaxIndices.length; i++) {
                        if (accuracyObject[sensitivityMaxIndices[i]] >= max) {
                            max = accuracyObject[sensitivityMaxIndices[i]];
                        }
                    }

                    var accuracyMaxIndices = [];
                    for (i = 0; i < sensitivityMaxIndices.length; i++) {
                        if (accuracyObject[sensitivityMaxIndices[i]] == max) {
                            accuracyMaxIndices.push(sensitivityMaxIndices[i]);
                        }
                    }
                    max = specificityObject[accuracyMaxIndices[0]];

                    for (i = 0; i < accuracyMaxIndices.length; i++) {
                        if (specificityObject[accuracyMaxIndices[i]] >= max) {
                            max = specificityObject[accuracyMaxIndices[i]];
                        }
                    }

                    var specificityMaxIndices = [];
                    for (i = 0; i < accuracyMaxIndices.length; i++) {
                        if (specificityObject[accuracyMaxIndices[i]] == max) {
                            specificityMaxIndices.push(accuracyMaxIndices[i]);
                        }
                    }

                    var accum = 0.0;
                    for (i = 0; i < specificityMaxIndices.length; i++) {
                        accum = accum + thresholdObject[specificityMaxIndices[i]];

                    }
                    
                    accum = accum / specificityMaxIndices.length;
                    $scope.currentThreshold = $scope.model.threshold != '-' ? $scope.model.threshold : accum;
                    $scope.suggestedThreshold = Math.round(accum * 1000000) / 1000000;

                    if (typeof $scope.suggestedThreshold === undefined || isNaN($scope.suggestedThreshold) || !$scope.suggestedThreshold) {
                        $scope.currentThreshold = $scope.model.threshold != '-' ? $scope.model.threshold : $scope.allYesMax[0];
                        $scope.suggestedThreshold = Math.round($scope.allYesMax[0] * 1000000) / 1000000;
                    }

                    for (jj = 0; jj < $scope.validations.length; jj++) {
                        $scope.validations[jj].threshold = ($scope.validations[jj].vmax > $scope.currentThreshold) ? 'yes' : 'no';
                    }
                    $scope.computeStats();
                    $scope.loadingValidations = false;
                }
            };
            
            $scope.computeStats = function() {
                $scope.thres = {
                    tpos: '-',
                    fpos: '-',
                    tneg: '-',
                    fneg: '-',
                    accuracy: '-',
                    precision: '-',
                    sensitivity: '-',
                    specificity: '-',
                };
                var trupositive = 0;
                var falsepositives = 0;
                var truenegatives = 0;
                var falsenegative = 0;
                for (var jj = 0; jj < $scope.validations.length; jj++) {
                    if ($scope.validations[jj].presence == 'yes') {
                        if ($scope.validations[jj].threshold == 'yes') {
                            trupositive = trupositive + 1;
                        }
                        else {
                            falsenegative = falsenegative + 1;
                        }
                    }
                    else {
                        if ($scope.validations[jj].threshold == 'yes') {
                            falsepositives = falsepositives + 1;
                        }
                        else {
                            truenegatives = truenegatives + 1;
                        }
                    }
                }
                
                $scope.thres.tpos = trupositive;
                $scope.thres.fpos = falsepositives;
                $scope.thres.tneg = truenegatives;
                $scope.thres.fneg = falsenegative;
                $scope.thres.accuracy = Math.round(((trupositive + truenegatives) / (trupositive + falsepositives + truenegatives + falsenegative)) * 100) / 100;

                if (trupositive + falsepositives > 0) {
                    $scope.thres.precision = Math.round((trupositive / (trupositive + falsepositives)) * 100) / 100;
                }
                if (trupositive + falsenegative > 0) {
                    $scope.thres.sensitivity = Math.round((trupositive / (trupositive + falsenegative)) * 100) / 100;
                }
                if (truenegatives + falsepositives > 0) {
                    $scope.thres.specificity = Math.round((truenegatives / (truenegatives + falsepositives)) * 100) / 100;
                }
            };
            
            $scope.saveThreshold = function() {
                $scope.messageSaved = '';
                $scope.recalculate();

                a2Models.setThreshold($stateParams.modelId, $scope.currentThreshold)
                    .success(function() {
                        $scope.messageSaved = 'Threshold saved';
                        $scope.model.threshold = $scope.currentThreshold;
                    })
                    .error(function() {
                        $scope.messageSaved = 'Error saving threshold';
                    });
            };
            
            $scope.recalculate = function() {
                $scope.messageSaved = '';
                var newval = parseFloat($scope.newthres);
                
                if (!isNaN(newval) && (newval <= 1.0) && (newval >= 0.0)) {
                    $scope.currentThreshold = newval;
                    for (var jj = 0; jj < $scope.validations.length; jj++) {
                        $scope.validations[jj].threshold = ($scope.validations[jj].vmax > $scope.currentThreshold) ? 'yes' : 'no';
                    }
                    $scope.computeStats();
                }
                else {
                    $scope.messageSaved = 'Value should be between 0 and 1.';
                }
            };
            
            $scope.zoomout = function() {
                $("#patternDivMain").css("min-width", 210);
                $("#patternDivMain").css("height", 100);
            };
            
            $scope.zoomin = function() {
                $("#patternDivMain").css("min-width", 420);
                $("#patternDivMain").css("height", 150);
            };
            
            $scope.getValidations = function() {
                var vals = [];
                for(var i = 0; i < $scope.validations.length; i++) {
                    vals.push({
                        site: $scope.validations[i].site,
                        date: $scope.validations[i].date,
                        user: $scope.validations[i].presence,
                        model: $scope.validations[i].model,
                        threshold: $scope.validations[i].threshold,
                        value: $scope.currentThreshold
                    });
                }
                return vals;
            };
            
            $scope.recDetails = function(rec) {
                $scope.selected = rec;
                $scope.showValidationsTable = false;
            };
            
            $scope.closeRecValidationsDetails = function() {
                $scope.showValidationsTable = true;
                $scope.selected = null;
            };
            
            $scope.gotoRec = function() {
                var rurl = "/project/" + Project.getUrl() + 
                    "/#/visualizer/rec/" + $scope.selectedRecId;
                $location.path(rurl);
            };
        }
    );
})(angular);
