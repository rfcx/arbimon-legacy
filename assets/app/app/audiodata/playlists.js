angular.module('a2.audiodata.playlists', [
    'a2.services', 
    'a2.directives', 
    'ui.bootstrap',
    'humane'
])
.controller('PlaylistCtrl', function($scope, a2Playlists, $modal, notify, a2UserPermit) {
    $scope.loading = true;
    
    a2Playlists.getList(function(data) {
        $scope.playlists = data;
        $scope.loading = false;
    });
    
    $scope.edit = function() {
        if(!$scope.selected)
            return;
            
        if(!a2UserPermit.can('manage playlists')) {
            notify.log('You do not have permission to edit playlists');
            return;
        }
        
        $scope.pname = $scope.selected.name;
        var playlist_id = $scope.selected.id;
        
        var modalInstance = $modal.open({
            templateUrl: '/app/audiodata/edit-playlist.html',
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
        
        if(!a2UserPermit.can('manage playlists')) {
            notify.log('You do not have permission to delete playlists');
            return;
        }
        
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
            templateUrl: '/common/templates/pop-up.html',
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
