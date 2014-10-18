angular.module('dashboard',['a2services', 'a2directives', 'ui.bootstrap'])
.config(function($stateProvider, $urlRouterProvider) {

    $urlRouterProvider.when("/dashboard", "/dashboard/summary");

    $stateProvider.state('dashboard.summary', {
        url: '/summary',
        controller:'SummaryCtrl',
        templateUrl: '/partials/dashboard/summary.html'
    })
    .state('dashboard.sites', {
        url: '/sites',
        controller:'SitesCtrl',
        templateUrl: '/partials/dashboard/sites.html'
    })
    .state('dashboard.species', {
        url: '/species',
        controller:'SpeciesCtrl',
        templateUrl: '/partials/dashboard/species.html'
    })
    .state('dashboard.settings', {
        url: '/settings',
        controller:'SettingsCtrl',
        templateUrl: '/partials/dashboard/settings.html'
    })
    .state('dashboard.users', {
        url: '/users',
        controller:'UsersCtrl',
        templateUrl: '/partials/dashboard/users.html'
    })

})
.controller('SummaryCtrl', function($scope, Project) {

    Project.getInfo(function(info){
         $scope.project = info;
    });
    
    Project.getClasses(function(species){
        $scope.species = species;
    });

    var mapOptions = {
        center: { lat: 18.3, lng: -66.5},
        zoom: 8
    };

    $scope.map = new google.maps.Map(document.getElementById('map-summary'), mapOptions);

    Project.getSites(function(sites) {
        $scope.sites = sites;

        var bounds = new google.maps.LatLngBounds();

        for(var i in sites) {
            var position = new google.maps.LatLng(sites[i].lat,sites[i].lon)

            sites[i].marker = new google.maps.Marker({
                position: position,
                title: sites[i].name
            });

            bounds.extend(position);

            sites[i].marker.setMap($scope.map);
        }

        $scope.map.fitBounds(bounds);
    });

    Project.getRecTotalQty(function(count) {
        $scope.recsQty = count;
    });
})
.controller('SitesCtrl', function($scope, Project, $http, $modal) {

    Project.getInfo(function(info){
         $scope.project = info;
    });


    $scope.editing = false;

    $scope.fields = [
        { name: 'Name', key: 'name' },
        { name: 'Latidude', key:'lat' },
        { name: 'Longitude', key: 'lon' },
        { name: 'Altitude', key: 'alt' }
    ];


    var mapOptions = {
        center: { lat: 18.3, lng: -66.5},
        zoom: 8
    };

    $scope.map = new google.maps.Map(document.getElementById('map-site'), mapOptions);

    Project.getSites(function(sites) {
        $scope.sites = sites;
    });

    $scope.save = function() {
        var action = $scope.editing ? 'update' : 'create';

        $http.post('/api/project/'+ action +'/site', {
            project: $scope.project,
            site: $scope.temp
        })
        .success(function(data) {
            if(data.error)
                alert(data.error);

            if(action === 'create') {
                $scope.creating = false;
            }
            else {
                $scope.editing = false;
            }

            Project.getSites(function(sites) {
                $scope.sites = sites;
            });
        })
        .error(function(data) {
            alert(data);
        });
    };



    $scope.del = function() {
        if(!$scope.checked || !$scope.checked.length)
            return;
        
        var sitesNames = $scope.checked.map(function(row) {
            return row.name;
        });
        
        var message = ["You are about to delete the following sites: "];
        var message2 = ["Are you sure??"];
        
        $scope.messages = message.concat(sitesNames, message2);
        
        $scope.btnOk = "Yes, do it!";
        $scope.btnCancel = "No";

        var modalInstance = $modal.open({
            templateUrl: '/partials/pop-up.html',
            scope: $scope
        });

        modalInstance.result.then(function() {
            $http.post('/api/project/delete/sites', {
                project: $scope.project,
                sites: $scope.checked
            })
            .success(function(data) {
                if(data.error)
                    alert(data.error);

                Project.getSites(function(sites) {
                    $scope.sites = sites;
                });
            })
            .error(function(data) {
                alert(data);
            });
        });
    }

    $scope.create = function() {
        $scope.temp = {};

        if(!$scope.marker) {
            $scope.marker = new google.maps.Marker({
                position: $scope.map.getCenter(),
                title: 'New Site Location'
            });
            $scope.marker.setMap($scope.map);
        }
        else {
            $scope.marker.setPosition($scope.map.getCenter());
        }

        $scope.marker.setDraggable(true);
        $scope.creating = true;

        google.maps.event.addListener($scope.marker, 'dragend', function(position) {
            //~ console.log(position);
            $scope.$apply(function () {
                $scope.temp.lat = position.latLng.lat();
                $scope.temp.lon = position.latLng.lng();
            });
        });
    };

    $scope.edit = function() {
        console.log($scope.editing);
        if(!$scope.selected)
            return;

        $scope.temp = JSON.parse(JSON.stringify($scope.selected));

        $scope.marker.setDraggable(true);

        google.maps.event.addListener($scope.marker, 'dragend', function(position) {
            //~ console.log(position);
            $scope.$apply(function () {
                $scope.temp.lat = position.latLng.lat();
                $scope.temp.lon = position.latLng.lng();
            });
        });

        $scope.editing = true;
    };

    $scope.sel = function($index) {
        //~ console.log('sel');

        $scope.editing = false;
        $scope.creating = false;

        $scope.selected = $scope.sites[$index];

        var position = new google.maps.LatLng($scope.selected.lat, $scope.selected.lon)

        if(!$scope.marker) {
            $scope.marker = new google.maps.Marker({
                position: position,
                title: $scope.selected.name
            });
            $scope.marker.setMap($scope.map);
        }
        else {
            $scope.marker.setDraggable(false);
            $scope.marker.setPosition(position);
            $scope.marker.setTitle($scope.selected.name);
        }

        $scope.map.panTo(position);
        //~ console.log($scope.selected);
    };

})
.controller('SpeciesCtrl', function($scope, Project, Species, Songtypes, $modal) {
    $scope.fields = [
        { name: 'Species', key: 'species_name' },
        { name: 'Song', key: 'songtype_name' }
    ];

    $scope.selected = {};

    Species.get(function(species){
        $scope.species = species;
    });

    Songtypes.get(function(songs) {
        $scope.songtypes = songs;
    });

    Project.getClasses(function(classes){
        $scope.classes = classes;
    });

    Project.getInfo(function(info){
         $scope.project = info;
    });


    $scope.submitSearch = function($event) {
        if($event.key === "Enter")
            $scope.searchSpecies();
    };

    $scope.searchSpecies = function() {
        if($scope.search === "")
            return;
        
        Species.search($scope.search, function(data){
            $scope.species = data;
        });
    };
    
    $scope.selectSpec = function(index){
        $scope.selected.species = $scope.species[index];
    };
    
    $scope.selectSong = function(index){
        $scope.selected.song = $scope.songtypes[index];
    };
    
    $scope.add = function(){
        if(!$scope.selected.species || !$scope.selected.song) {
            return;
        }
        
        console.log($scope.selected);
        
        Project.addClass({
            species: $scope.selected.species.scientific_name,
            songtype: $scope.selected.song.name,
            project_id: $scope.project.project_id
        },
        function(err, result){
            if(err) alert(err);
            
            console.log(result);
            Project.getClasses(function(classes){
                $scope.classes = classes;
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
        
        $scope.messages = message.concat(speciesClasses, message2);
        
        $scope.btnOk = "Yes, do it!";
        $scope.btnCancel = "No";
        
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
                if(err) alert(err);
                
                console.log(result);
                Project.getClasses(function(classes){
                    $scope.classes = classes;
                });
            });
        });
        
    }
})
.controller('SettingsCtrl', function($scope, Project) {
    Project.getInfo(function(info) {
        $scope.project = info;
    });
    
    $scope.save = function() {
        Project.updateInfo({
            project: $scope.project
        }, 
        function(err, result){
            if(err) alert(err);
            
            console.log(result);
        });
    }
})
.controller('UsersCtrl', function($scope, $http, Project, $modal) {
    
    Project.getInfo(function(info) {
        $scope.project = info;
    });
    
    Project.getUsers(function(err, users){
        $scope.users = users;
    });
    
    Project.getRoles(function(err, roles){
        $scope.roles = roles;
    });
    
    $scope.findUser = function(query) {
        return $http.get('/api/user/search/'+ query)
        .then(function(response) { 
            return response.data;
        });
    };
    
    $scope.add = function() {
        if(!$scope.userToAdd)
            return;
        
        console.log('addUser');
        
        Project.addUser({
            project_id: $scope.project.project_id,
            user_id: $scope.userToAdd.id
        },
        function(err, result){
            if(err) alert(err);
            
            console.log(result);
            Project.getUsers(function(err, users){
                $scope.users = users;
            });
        });
    };
    
    $scope.changeRole = function($index) {
        console.log($scope.users[$index]);
        
        var role = $scope.roles.filter(function(value){
            return $scope.users[$index].rolename === value.name;
        })[0];
        
        Project.changeUserRole({
            project_id: $scope.project.project_id,
            user_id: $scope.users[$index].id,
            role_id: role.id
        },
        function(err, result){
            if(err) alert(err);
            
            console.log(result);
            Project.getUsers(function(err, users){
                $scope.users = users;
            });
        });
    };
    
    $scope.del = function($index) {
        
        $scope.messages = [
            "You are about to remove: ",
            $scope.users[$index].username,
            "Are you sure??"
        ];
        
        $scope.btnOk = "Yes, do it!";
        $scope.btnCancel = "No";
        
        var modalInstance = $modal.open({
            templateUrl: '/partials/pop-up.html',
            scope: $scope
        });
        
        modalInstance.result.then(function() {
            Project.delUser({
                project_id: $scope.project.project_id,
                user_id: $scope.users[$index].id
            },
            function(err, result){
                if(err) alert(err);
                
                console.log(result);
                Project.getUsers(function(err, users){
                    $scope.users = users;
                });
            });
        });
    };
})
;
