angular.module('a2.audiodata.playlists', [
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'a2.audiodata.playlists.playlist-arithmetic',
    'humane'
])
.config(function($stateProvider) {
    $stateProvider.state('audiodata.playlists', {
        url: '/playlists',
        controller: 'PlaylistCtrl as controller',
        templateUrl: '/app/audiodata/playlists/playlists.html'
    });
})
.controller('PlaylistCtrl', function($scope, a2Playlists, $modal, notify, a2UserPermit, $location) {
    this.initialize = function(){
        removeOnInvalidateHandler = a2Playlists.$on('invalidate-list', (function(){
            this.reset();
        }).bind(this));
        this.reset();
    };

    this.reset = function(){
        $scope.loading = true;
        a2Playlists.getList({info:true}).then(function(data) {
            $scope.playlists = data;
            $scope.loading = false;
        });
    };

    this.operate = function(expression){
        if(!a2UserPermit.can('manage playlists')) {
            notify.error('You do not have permission to combine playlists');
            return;
        }

        return a2Playlists.combine(expression).then(function(){
            notify.log('Playlist created');
        }).catch(function(err){
            err = err || {};
            notify.error(err.message || err.data || 'Server error');
        });
    };

    this.edit = function() {
        if(!$scope.checked.length || $scope.checked.length > 1) {
            notify.log('Please select one playlist to edit');
            return;
        }

        if(!a2UserPermit.can('manage playlists')) {
            notify.error('You do not have permission to edit playlists');
            return;
        }

        $scope.pname = $scope.checked[0].name;
        const playlist_id = $scope.checked[0].id;
        const modalInstance = $modal.open({
            templateUrl: '/app/audiodata/edit-playlist.html',
            scope: $scope,
            windowClass: 'modal-element width-490'
        });

        modalInstance.result.then(function(playlistName) {
            a2Playlists.rename({
                id: playlist_id,
                name: playlistName
            },
            function(data) {
                if(data.error)
                    return console.log(data.error);
            });
        });
    };
    $scope.del = function() {
        if(!$scope.checked || !$scope.checked.length)
            return;

        if(!a2UserPermit.can('manage playlists')) {
            notify.error('You do not have permission to delete playlists');
            return;
        }

        
        var list = []
        const playlists = $scope.checked.map(function(row) {
            list.push(row.name)
            return '"'+ row.name +'"';
        });

        if (list.length > 3) {
            const msg = '& ' + (list.length - 3) + ' other playlists'
            list = list.slice(0, 3)
            list.push(msg) // if need to show 3 playlists '& ... other playlists'
        }

        const message = ["You are about to delete the following playlists: "];
        $scope.popup = {
            title: "Delete playlists",
            messages: message,
            list: playlists,
            btnOk: "Yes",
            btnCancel: "No",
            isForDeletePopup: true
        };


        const modalInstance = $modal.open({
            templateUrl: '/common/templates/pop-up.html',
            scope: $scope,
            windowClass: 'modal-element width-490'
        });

        modalInstance.result.then(function() {

            const playlistIds = $scope.checked.map(function(pl) {
                return pl.id;
            });

            $scope.loading = true;
            a2Playlists.remove(playlistIds, function(data) {
                if(data.error)
                    return notify.error(data.error);

                a2Playlists.getList().then(function(data) {
                    $scope.playlists = data;
                    $scope.loading = false;
                    notify.log((playlistIds.length > 1 ? 'Playlists ' : 'Playlist ') + 'deleted');
                });
            });
        });
    };

    $scope.create = function (url) {
        $location.path(url);
   };

    this.initialize();

})
;
