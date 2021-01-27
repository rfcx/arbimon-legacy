angular.module('a2.audiodata.recordings', [
    'a2.directive.a2-auto-close-on-outside-click',
    'a2.service.download-resource',
    'a2.audiodata.recordings.data-export-parameters',
    'a2.audiodata.recordings.filter-parameters',
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'humane'
])
.config(function($stateProvider) {
    $stateProvider.state('audiodata.recordings', {
        url: '/recordings',
        controller: 'RecsCtrl as controller',
        templateUrl: '/app/audiodata/recordings/recordings.html'
    });
})
.controller('RecsCtrl', function(
    $scope,
    Project,
    a2Classi, $http, $modal, notify, a2UserPermit,
    $downloadResource,
    $window
) {

    this.getSearchParameters = function(output){
        var params = angular.merge({}, $scope.params);
        output = output || ['list'];
        params.output = output;
        params.limit = $scope.limitPerPage;
        params.offset = output.indexOf('list') >= 0 ? ($scope.currentPage-1) * $scope.limitPerPage : 0;
        params.sortBy = $scope.sortKey? $scope.sortKey : 'datetime';
        params.sortRev = $scope.reverse? $scope.reverse : true;
        return params;
    };

    this.searchRecs = function(output) {
        output = output || ['list'];
        var params = this.getSearchParameters(output);
        var expect = output.reduce(function(obj, a){
            obj[a] = true;
            return obj;
        }, {});

        Project.getRecs(params, function(data) {
            if(output.length == 1){
                data = output.reduce(function(obj, a){
                    obj[a] = data;
                    return obj;
                }, {});
            }
            if(expect.list) {
                $scope.recs = data.list;

                $scope.recs.forEach(function(rec) {
                    rec.datetime = new Date(rec.datetime);
                });
                $scope.loading = false;
            }
            if(expect.count){
                $scope.totalRecs = data.count;
            }
        	if(expect.date_range && data.date_range.min_date && data.date_range.max_date) {
                $scope.minDate = new Date(new Date(data.date_range.min_date.substr(0, 10) + "T00:00:00.000Z").getTime() - 24*60*60*1000);
                $scope.maxDate = new Date(new Date(data.date_range.max_date.substr(0, 10) + "T23:59:59.999Z").getTime() + 24*60*60*1000);
            }
        });
    };

    this.sortRecs = function(sortKey, reverse) {
        $scope.sortKey = sortKey;
        $scope.reverse = reverse;
        this.searchRecs();
    };
    this.applyFilters = function(filters) {
        $scope.currentPage = 1;
        $scope.params = filters;
        this.searchRecs(['count', 'list']);
    };
    this.reloadList = function() {
        this.searchRecs(['count', 'list']);
    };
    this.createPlaylist = function(filters) {
        var listParams = filters;

        if(!Object.keys(listParams).length)
            return;

        if(!a2UserPermit.can('manage playlists')) {
            notify.log('You do not have permission to create playlists');
            return;
        }

        var modalInstance = $modal.open({
            controller: 'SavePlaylistModalInstanceCtrl',
            templateUrl: '/app/audiodata/create-playlist.html',
            resolve: {
                listParams: function() {
                    return listParams;
                }
            },
            backdrop: false
        });

        modalInstance.result.then(function() {
            notify.log('Playlist created');
        });
    };

    this.deleteRecordings = function() {
        if(!a2UserPermit.can('manage project recordings')) {
            notify.log('You do not have permission to delete recordings');
            return;
        }

        var recs = $scope.checked.filter(function(rec){
                return !rec.imported;
            });

        if(!recs || !recs.length){
            return notify.log('Recordings from imported sites can not be deleted');
        }

        var recCount = recs.reduce(function(_, rec){
            _[rec.site] = _[rec.site] + 1 || 1;
            return _;
        }, {});

        var messages = [];
        messages.push("You are about to delete: ");
        messages.push.apply(messages, Object.keys(recCount).map(function(site) {
            var s = recCount[site] > 1 ? 's' : '';
            return recCount[site] + ' recording'+s+' from "' + site + '"';
        }));
        messages.push("Are you sure?");

        return $modal.open({
            templateUrl: '/common/templates/pop-up.html',
            controller: function() {
                this.messages = messages;
                this.btnOk =  "Yes";
                this.btnCancel =  "No, cancel";
            },
            controllerAs: 'popup'
        }).result.then(function() {
            var recIds = recs.map(function(rec) { return rec.id; });
            return $http.post('/api/project/'+Project.getUrl()+'/recordings/delete', { recs: recs });
        }).then((function(response){
            if(response.data.error){
                return notify.error(response.data.error);
            }

            this.searchRecs(['count', 'list']);

            notify.log(response.data.msg);
        }).bind(this));
    };

    this.deleteMatchingRecordings = function() {
        var filters = $scope.params;

        if(!a2UserPermit.can('manage project recordings')) {
            notify.log('You do not have permission to delete recordings');
            return;
        }

        return Project.getRecCounts(filters).then(function(recCount) {
            // var recCount = recs.reduce(function(_, rec){
            //     _[rec.site] = _[rec.site] + 1 || 1;
            //     return _;
            // }, {});

            var messages = [], importedCount = 0, importedSites = [];
            messages.push("You are about to delete: ");
            recCount.forEach(function(entry) {
                var s = entry.count > 1 ? 's' : '';
                if(!entry.imported){
                    messages.push(entry.count + ' recording'+s+' from "' + entry.site + '"');
                } else {
                    importedCount += entry.count;
                    importedSites.push('"' + entry.site + '"');
                }
            });
            messages.push("Are you sure?");
            if(importedCount){
                messages.push("(The filters matched " + importedCount + " recordings wich come from " + importedSites.join(", ") + ". You cannot delete these from your project, they can only be removed from their original project.)");
            }

            return $modal.open({
                templateUrl: '/common/templates/pop-up.html',
                controller: function() {
                    this.messages = messages;
                    this.btnOk =  "Yes";
                    this.btnCancel =  "No, cancel";
                },
                controllerAs: 'popup'
            }).result;
        }).then(function() {
            return $http.post('/api/project/'+Project.getUrl()+'/recordings/delete-matching', filters);
        }).then((function(response){
            if(response.data.error){
                return notify.error(response.data.error);
            }

            this.searchRecs(['count', 'list']);

            notify.log(response.data.msg);
        }).bind(this));
    };

    $scope.loading = true;
    $scope.params = {};
    $scope.loading = true;
    $scope.currentPage  = 1;
    $scope.limitPerPage = 10;

    this.searchRecs(['count', 'date_range', 'list']);

    this.setCurrentPage = function(currentPage){
        $scope.currentPage = currentPage;
        this.searchRecs();
    };
    this.setLimitPerPage = function(limitPerPage){
        $scope.limitPerPage = limitPerPage;
        this.searchRecs();
    };

    this.exportRecordings = function(parameters){
        $downloadResource(Project.getRecordingDataUrl($scope.params, parameters));
    };

})
.controller('SavePlaylistModalInstanceCtrl', function($scope, $modalInstance, a2Playlists, listParams) {
    $scope.savePlaylist = function(name) {
        a2Playlists.create({
            playlist_name: name,
            params: listParams
        },
        function(data) {
            if (data.error) {
                $scope.errMess = data.error;
            }
            else {
                $modalInstance.close();
            }
        });
    };
    $scope.changePlaylistName = function() {
        $scope.errMess = null;
    }
})
;
