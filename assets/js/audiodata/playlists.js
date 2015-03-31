angular.module('audiodata.playlists', [
    'a2services', 
    'a2directives', 
    'ui.bootstrap',
    'humane'
])
.controller('PlaylistCtrl', function($scope, a2Playlists, $modal, notify) {
    $scope.loading = true;
    
    a2Playlists.getList(function(data) {
        $scope.playlists = data;
        $scope.loading = false;
    });
    
    $scope.edit = function() {
        if(!$scope.selected)
            return;
        
        $scope.pname = $scope.selected.name;
        var playlist_id = $scope.selected.id;
        
        var modalInstance = $modal.open({
            templateUrl: '/partials/audiodata/edit-playlist.html',
            scope: $scope
        });
        
        modalInstance.result.then(function(playlistName) {
            a2Playlists.rename({
                id: playlist_id,
                name: playlistName
            }, 
            function(data) {
                if(data.error)
                    return console.log(data.error);
                
                $scope.selected.name = playlistName;
            });
        });
    };
    $scope.del = function() {
        if(!$scope.checked || !$scope.checked.length)
            return;
        
        var playlists = $scope.checked.map(function(row) {
            return '"'+ row.name +'"';
        });
        
        var message = ["You are about to delete the following playlists: "];
        var message2 = ["Are you sure??"];
        
        $scope.popup = {
            messages: message.concat(playlists, message2),
            btnOk: "Yes, do it!",
            btnCancel: "No",
        };
        
        
        var modalInstance = $modal.open({
            templateUrl: '/partials/pop-up.html',
            scope: $scope
        });
        
        modalInstance.result.then(function() {
            
            var playlistIds = $scope.checked.map(function(pl) {
                return pl.id;
            });
            
            a2Playlists.remove(playlistIds, function(data) {
                if(data.error)
                    return notify.log(data.error);
                
                a2Playlists.getList(function(data) {
                    $scope.playlists = data;
                    $scope.loading = false;
                    notify.log('Playlist deleted');
                });
            });
        });
    };
})
;
