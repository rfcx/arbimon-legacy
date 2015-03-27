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

            var initTable = function() {
                $scope.tableParams = new ngTableParams({
                    page: 1,
                    count: 10,
                    sorting: {
                        mname: 'asc'
                    }
                }, {
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
            };

            $scope.loadModels = function() {
                a2Models.list(function(data) {
                    $scope.modelsData = data;
                    $scope.modelsDataOrig = data;
                    $scope.infoInfo = "";
                    $scope.showInfo = false;
                    $scope.loading = false;

                    if (data.length > 0) {
                        if (!$scope.tableParams) {
                            initTable();
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
            $scope.loadModels();

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
                        console.log('new classification: ' + new Date());
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
                                notify.log("Model Deleted Successfully");
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
                                notify.log("New Model Training on Queue");
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

            $scope.$watch('data.usePresentTraining',
                function() {
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

            $scope.$watch('data.useNotPresentTraining',
                function() {
                    var val = $scope.data.absentsValidations - $scope.data.useNotPresentTraining;
                    if (val > -1) {
                        $scope.data.useNotPresentValidation = val;
                    }
                    else
                        $scope.data.useNotPresentValidation = 0;

                    if ($scope.data.useNotPresentTraining > $scope.data.absentsValidations)
                        $scope.data.useNotPresentTraining = $scope.data.absentsValidations;

                });

            $scope.$watch('data.training',
                function() {
                    if ($scope.data.training !== '') {
                        Project.getValidationsBySpeciesSong($scope.data.training.species_id, $scope.data.training.songtype_id,
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
                    .success(
                        function(data, status, headers, config) {
                            if (data.name) {
                                $scope.nameMsg = 'Name exists';
                            }
                            else {
                                $modalInstance.close(data);
                            }
                        }
                    )
                    .error(
                        function(data, status, headers, config) {
                            $modalInstance.close({
                                err: "Could not create job"
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
        function($scope, a2Models, $stateParams, $location, Project, a2Classi, notify) {
            $scope.project_url = Project.getUrl();
            $scope.project_id = -1;

            Project.getInfo(function(data) {
                $scope.project_id = data.project_id;
            });

            $scope.showValidationsTable = true;
            $scope.infoInfo = "Loading...";
            $scope.showInfo = true;
            $scope.loading = true;
            $scope.recsUris = [];
            $scope.selectedVect = null;
            $scope.selectedVectWatch = null;
            $scope.waitCallsNUmber = 0;
            $scope.waitCallsNUmberIndex = 0;
            $scope.$watch('selectedVectWatch', function() {
                $scope.selectedVect = $scope.selectedVectWatch;
            });

            $scope.allYesMax = [];
            $scope.vectorNoMax = -1;

            $scope.suggestedThreshold = null;
            $scope.databaseThreshold = null;
            $scope.currentThreshold = null;
            $scope.loadingValidations = true;
            a2Models.getValidationResults($stateParams.modelId, function(vdata) {
                if (vdata.err == 'list not found') {
                    $scope.showModelValidations = false;
                    $scope.loadingValidations = false;
                }
                else if ($scope.data) {
                    $scope.validations = vdata;

                    $scope.valiDetails = $scope.validations.nofile ? false : true;
                    $scope.waitCallsNUmber = $scope.validations.length;
                    for (var i = 0; i < $scope.validations.length; i++) {
                        $scope.getRecVali($scope.validations[i], i);
                    }
                }
            });


            $scope.getRecVali = function(currRec, i) {

                var pieces = currRec.url.split('/');
                var filename = pieces[pieces.length - 1];
                fileName = filename.replace('.thumbnail.png', '.flac');
                var vectorUri = 'project_' + $scope.project_id + '/training_vectors/job_' + $scope.data.job_id + '/' + fileName;
                a2Classi.getRecVector(vectorUri, function(data) {
                    if(!(data.err && data.err == "vector-not-found")) {
                        var vector = data.data.split(",");
                        for (var jj = 0; jj < vector.length; jj++) {
                            vector[jj] = parseFloat(vector[jj]);
                        }
                        var vectorLength = vector.length;

                        var vmax = Math.max.apply(null, vector);
                        $scope.validations[i].vmax = vmax;
                        $scope.validations[i].vector = vector;
                        if (currRec.presence == 'no') {
                            if ($scope.vectorNoMax < vmax) {
                                $scope.vectorNoMax = vmax;
                            }
                        }

                        if (currRec.presence == 'yes') {
                            $scope.allYesMax.push(vmax);
                        }

                        $scope.waitinFunction();
                    }
                    $scope.waitinFunction();
                });
            };

            $scope.loadingValidations = true;
            $scope.showModelValidations = true;


            $scope.waitinFunction = function() {
                $scope.waitCallsNUmberIndex = $scope.waitCallsNUmberIndex + 1;
                if ($scope.waitCallsNUmber == $scope.waitCallsNUmberIndex) {
                    if ($scope.allYesMax.length > 0) {
                        $scope.allYesMax = $scope.allYesMax.sort();
                        var index = 0;
                        for (var j = 0; j < $scope.allYesMax.length; j++) {
                            if ($scope.allYesMax[j] >= $scope.vectorNoMax) {
                                index = j;
                            }
                        }
                        $scope.data.maxv = Math.max.apply(null, $scope.allYesMax);
                        $scope.data.maxvRounded = Math.round($scope.data.maxv * 1000) / 1000;
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
                            
                            console.log(sumObject.length);
                            
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
                            $scope.currentThreshold = $scope.databaseThreshold != '-' ? $scope.databaseThreshold : accum;
                            $scope.suggestedThreshold = Math.round(accum * 1000000) / 1000000;
                            $scope.currentThresholdRounded = $scope.databaseThreshold != '-' ? $scope.databaseThreshold : Math.round(accum * 1000000) / 1000000;

                            if (typeof $scope.suggestedThreshold === undefined || isNaN($scope.suggestedThreshold) || !$scope.suggestedThreshold) {
                                $scope.currentThreshold = $scope.databaseThreshold != '-' ? $scope.databaseThreshold : $scope.allYesMax[0];
                                $scope.suggestedThreshold = Math.round($scope.allYesMax[0] * 1000000) / 1000000;
                                $scope.currentThresholdRounded = $scope.databaseThreshold != '-' ? $scope.databaseThreshold : $scope.suggestedThreshold;
                            }

                            for (jj = 0; jj < $scope.validations.length; jj++) {
                                $scope.validations[jj].threshold = ($scope.validations[jj].vmax > $scope.currentThreshold) ? 'yes' : 'no';
                            }
                            $scope.computeStats();
                            $scope.validationsData = $scope.validations;
                            $scope.loadingValidations = false;
                        }
                    }
                    else {
                        $scope.showModelValidations = false;
                        $scope.loadingValidations = false;
                    }
                }
            };

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


            $scope.messageSaved = '';


            $scope.saveThreshold = function() {
                $scope.messageSaved = '';
                $scope.recalculate();

                a2Models.setThreshold($stateParams.modelId, $scope.currentThreshold)
                    .success(function() {
                        $scope.messageSaved = 'Threshold saved';
                        $scope.databaseThreshold = $scope.currentThreshold;
                    })
                    .error(function() {
                        $scope.messageSaved = 'Error saving threshold';
                    });
            };

            $scope.invalid = false;

            $scope.recalculate = function() {
                // TODO need fix jQuery most be used only on directives
                var newval = $('#newthres').val(); 
                $scope.messageSaved = '';
                newval = parseFloat(newval);

                if (!isNaN(newval) && (newval <= 1.0) && (newval >= 0.0)) {
                    $scope.currentThreshold = newval;
                    $scope.currentThresholdRounded = Math.round(newval * 1000000) / 1000000;
                    for (var jj = 0; jj < $scope.validations.length; jj++) {
                        $scope.validations[jj].threshold = ($scope.validations[jj].vmax > $scope.currentThreshold) ? 'yes' : 'no';
                    }
                    $scope.computeStats();
                }
                else {
                    $scope.messageSaved = 'Value should be between 0 and 1.';
                }
            };

            $scope.currentThreshold = '-';
            $scope.currentThresholdRounded = '-';
            a2Models.findById($stateParams.modelId, function(data) {
                $scope.databaseThreshold = (data.threshold === null) ? '-' : data.threshold;
                if (data && data.json) {
                    $scope.data = {
                        thresholdFromDb: parseFloat(data.threshold),
                        job_id: data.job_id,
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
                        maxv: data.json.maxv,
                        maxvRounded: Math.round(data.json.maxv * 1000) / 1000,
                        minv: data.json.minv,
                        roicount: data.json.roicount, //ok
                        hfreq: Math.round(data.json.roihighfreq * 100) / 100, //ok
                        lfreq: Math.round(data.json.roilowfreq * 100) / 100, //ok
                        rlength: Math.round(data.json.roilength * 100) / 100, //ok
                        bw: Math.round(((parseFloat(data.json.roihighfreq) - parseFloat(data.json.roilowfreq)) * 100)) / 100,
                        freqMax: data.json.roisamplerate / 2, //ok
                    };
                }
                else $scope.invalid = true;
            });



            $scope.getValidations = function() {
                var vals = [];
                for (var i = 0; i < $scope.validationsData.length; i++) {
                    vals.push({
                        site: $scope.validationsData[i].site,
                        date: $scope.validationsData[i].date,
                        user: $scope.validationsData[i].presence,
                        model: $scope.validationsData[i].model,
                        threshold: $scope.validationsData[i].threshold,
                        value: $scope.currentThreshold
                    });
                }
                return vals;
            };

            $scope.savedhtml = '';
            $scope.recNameInVectorViewDate = '';
            $scope.recNameInVectorViewSite = '';
            $scope.recNameInVectorViewUser = '';
            $scope.recNameInVectorViewModel = '';
            $scope.recNameInVectorViewTh = '';
            $scope.selectedUri = '';
            $scope.selectedRecId = -1;


            $scope.recDetails = function(rec) {
                console.log(rec);
                var selected = rec;
                $scope.recNameInVectorViewDate = rec.date;
                $scope.recNameInVectorViewSite = rec.site;
                $scope.recNameInVectorViewUser = rec.presence;
                $scope.recNameInVectorViewModel = rec.model;
                $scope.recNameInVectorViewTh = rec.threshold;
                $scope.selectedUrl = rec.url;
                var pieces = rec.url.split('/');
                var filename = pieces[pieces.length - 1];
                fileName = filename.replace('.thumbnail.png', '.flac');
                $scope.selectedRecId = rec.id;
                $scope.selectedVectWatch = rec.vector;
                $scope.showValidationsTable = false;
            };


            $scope.closeRecValidationsDetails = function() {
                $scope.showValidationsTable = true;
                $scope.selectedVectWatch = null;
            };

            $scope.gotoRec = function() {
                var rurl = "/project/" + $scope.project_url + "/#/visualizer/rec/" + $scope.selectedRecId;
                $location.path(rurl);
            };

            $scope.fields = [
                {
                    name: 'Date',
                    key: 'date'
                }, 
                {
                    name: 'Site',
                    key: 'site'
                }, 
                {
                    name: 'User presence',
                    key: 'presence'
                }, 
                {
                    name: 'Model presence',
                    key: 'model'
                }, 
                {
                    name: 'Threshold presence',
                    key: 'threshold'
                }
            ];
            $scope.validationRows = null;
        }
    );
})(angular);
