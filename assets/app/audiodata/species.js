angular.module('a2.audiodata.species', [
    'a2.services', 
    'a2.directives', 
    'ui.bootstrap',
    'humane'
])
.controller('SpeciesCtrl', function($scope, Project, $modal, notify, a2UserPermit) {
    $scope.loading = true;
    $scope.selected = {};
    
    Project.getClasses(function(classes){
        $scope.classes = classes;
        $scope.loading = false;
    });
    
    Project.getInfo(function(info){
        $scope.project = info;
    });
    
    
    $scope.add = function() {
        
        if(!a2UserPermit.can("manage project species")) {
            notify.log("You do not have permission to add species");
            return;
        }
        
        var modalInstance = $modal.open({
            templateUrl: '/audiodata/select-species.html',
            controller: 'SelectSpeciesCtrl',
            size: 'lg',
        });
        
        modalInstance.result.then(function(selected) {
            
            var cls = {
                species: selected.species.scientific_name,
                songtype: selected.song.name
            };
            
            Project.addClass(cls)
                .success(function(result){
                    notify.log(selected.species.scientific_name + ' ' + selected.song.name +" added to project");
                    
                    Project.getClasses(function(classes){
                        $scope.classes = classes;
                    });
                })
                .error(function(data, status) {
                    if(status < 500)
                        notify.error(data.error);
                    else
                        notify.serverError();
                });
            
        });
    };
    
    $scope.del = function() {
        if(!$scope.checked || !$scope.checked.length)
            return;
        
        if(!a2UserPermit.can("manage project species")) {
            notify.log("You do not have permission to remove species");
            return;
        }
        
        var speciesClasses = $scope.checked.map(function(row) {
            return '"'+row.species_name +' | ' + row.songtype_name+'"';
        });
        
        var message = ["You are about to delete the following project species: "];
        var message2 = ["Are you sure??"];
        
        $scope.popup = {
            messages: message.concat(speciesClasses, message2),
            btnOk: "Yes, do it!",
            btnCancel: "No",
        };
        
        var modalInstance = $modal.open({
            templateUrl: '/partials/pop-up.html',
            scope: $scope
        });
        
        modalInstance.result.then(function() {
            var classesIds = $scope.checked.map(function(row) {
                return row.id;
            });
            
            var params = {
                project_classes: classesIds
            };
            
            Project.removeClasses(params)
                .success(function(result) {
                    Project.getClasses(function(classes){
                        $scope.classes = classes;
                    });
                })
                .error(function(data, status) {
                    if(status < 500)
                        notify.error(data.error);
                    else
                        notify.serverError();
                });
        });
            
    };
})
.controller('SelectSpeciesCtrl', function($scope, Species, Songtypes) {
    
    Songtypes.get(function(songs) {
        $scope.songtypes = songs;
    });
    
        
    $scope.searchSpecies = function() {
        if($scope.search === "") {
            $scope.species = [];
            return;
        }
    
        Species.search($scope.search, function(results){
            $scope.species = results;
        });
    };
})
;
