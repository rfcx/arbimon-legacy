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
        params.sortBy = $scope.sortKey;
        params.sortRev = $scope.reverse;
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
            if(expect.date_range) {
                $scope.minDate = new Date(data.date_range.min_date);
                $scope.maxDate = new Date(data.date_range.max_date);
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
            templateUrl: '/audiodata/create-playlist.html',
            resolve: {
                listParams: function() {
                    return listParams;
                }
            }
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
        messages.push("Are you sure??");
        
        return $modal.open({
            templateUrl: '/pop-up.html',
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
})
;
