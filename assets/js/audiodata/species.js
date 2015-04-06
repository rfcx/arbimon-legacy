angular.module('audiodata.species', [
    'a2services', 
    'a2directives', 
    'ui.bootstrap',
    'humane'
])
.controller('SpeciesCtrl', function($scope, Project, $modal, notify) {
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
        
        var modalInstance = $modal.open({
            templateUrl: '/partials/audiodata/select-species.html',
            controller: 'SelectSpeciesCtrl',
            size: 'lg',
        });
        
        modalInstance.result.then(function(selected) {
            
            Project.addClass({
                species: selected.species.scientific_name,
                songtype: selected.song.name,
                project_id: $scope.project.project_id
            },
            function(err, result){
                if(err) return console.error(err);
                
                if(result.error) {
                    return notify.error(result.error);
                }
                
                notify.log(selected.species.scientific_name + ' ' + selected.song.name +" added to project");
                
                Project.getClasses(function(classes){
                    $scope.classes = classes;
                });
            });
            
        });
    };
    
    $scope.del = function(){
        if(!$scope.checked || !$scope.checked.length)
            return;
            
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
            
            Project.removeClasses({
                project_id: $scope.project.project_id,
                project_classes: classesIds
            },
            function(err, result) {
                if(err) {
                    notify.error('Error Communicating with Server');
                }
                
                console.log(result);
                Project.getClasses(function(classes){
                    $scope.classes = classes;
                });
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
