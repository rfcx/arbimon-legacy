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
    $downloadResource
) {
    $scope.selectedRecId = []
    $scope.checkedRec = []
    this.getSearchParameters = function(output){
        var params = angular.merge({}, $scope.params);
        output = output || ['list'];
        params.output = output;
        params.limit = $scope.limitPerPage;
        params.offset = output.indexOf('list') >= 0 ? ($scope.currentPage-1) * $scope.limitPerPage : 0;
        params.sortBy = 'r.site_id DESC, r.datetime DESC';
        if (params.range) {
            params.range.from = moment(params.range.from).format('YYYY-MM-DD') + 'T00:00:00.000Z';
            params.range.to = moment(params.range.to).format('YYYY-MM-DD') + 'T23:59:59.999Z';
        }
        return params;
    };

    this.searchRecs = function(output) {
        $scope.loading = true;
        output = output || ['list'];
        var params = this.getSearchParameters(output);
        var expect = output.reduce(function(obj, a){
            obj[a] = true;
            return obj;
        }, {});
        if (expect.list) {
            $scope.recs = []
        }
        if (expect.count) {
            $scope.totalRecs = undefined
        }

        Project.getRecs(params, function(data) {
            if(output.length == 1){
                data = output.reduce(function(obj, a){
                    obj[a] = data;
                    return obj;
                }, {});
            }
            if(expect.list) {
                $scope.recs = data.list;
                // Show selected recordings across pagination
                $scope.recs.forEach(rec => {
                    if ($scope.selectedRecId.includes(rec.id)) {
                        rec.checked = true
                    }
                })
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

    this.exportPermit = function() {
        return a2UserPermit.can('manage project recordings')
    };

    this.createPlaylist = function() {
        var listParams = angular.merge({}, $scope.params);

        if (!Object.keys(listParams).length) {
            notify.log('Filter recordings and create a playlist');
            return;
        }

        if ($scope.totalRecs == 0) {
            notify.error('You can\'t create playlist with 0 recording');
            return;
        }

        if (!a2UserPermit.can('manage playlists')) {
            notify.error('You do not have permission to create playlists');
            return;
        }

        if (listParams.tags && listParams.tags.length) {
            listParams.tags = listParams.tags.flat()
        }

        if (listParams.presence && listParams.presence.length) {
            listParams.presence = listParams.presence[0]
        }

        if (listParams.range) {
            listParams.range.from = moment(listParams.range.from).format('YYYY-MM-DD') + 'T00:00:00.000Z';
            listParams.range.to = moment(listParams.range.to).format('YYYY-MM-DD') + 'T23:59:59.999Z';
        }

        if ($scope.selectedRecId && $scope.selectedRecId.length) {
            listParams.recIds = $scope.selectedRecId;
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

        modalInstance.result.then(function(data) {
            if (data.message === 'Playlist created') {
                notify.log(data.message);
            }
        });
    };

    this.deleteRecordings = function() {
        if (!a2UserPermit.can('manage project recordings')) {
            notify.error('You do not have permission to delete recordings');
            return;
        }

        const recs = $scope.checkedRec.filter(function(rec){
            return !rec.imported;
        });

        if (!recs || !recs.length){
            return notify.log('Recordings from imported sites can not be deleted');
        }

        const recCount = recs.reduce(function(_, rec){
            _[rec.site] = _[rec.site] + 1 || 1;
            return _;
        }, {});

        const messages = [];
        messages.push("You are about to delete: ");
        messages.push.apply(messages, Object.keys(recCount).map(function(site) {
            const s = recCount[site] > 1 ? 's' : '';
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
            return $http.post('/api/project/'+Project.getUrl()+'/recordings/delete', { recs: recs });
        }).then((function(response){
            if(response.data.error){
                return notify.error(response.data.error);
            }

            this.searchRecs(['count', 'list']);

            notify.log(response.data.msg);
        }).bind(this));
    };

    this.deleteAllRecordings = function() {
        var filters = $scope.params;

        if(!a2UserPermit.can('manage project recordings')) {
            notify.error('You do not have permission to delete recordings');
            return;
        }

        return Project.getRecCounts(filters).then(function(recCount) {
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

    $scope.params = {};
    $scope.loading = true;
    $scope.currentPage  = 1;
    $scope.limitPerPage = 10;

    this.searchRecs(['count', 'date_range', 'list']);

    $scope.selectRec = function(rec) {
        if (!rec.checked) {
            const index = $scope.selectedRecId.findIndex(rec => rec === rec.id);
            $scope.selectedRecId.splice(index, 1);
            $scope.checkedRec.splice(index, 1);
            return;
        }
        if ($scope.selectedRecId.includes(rec.id)) return;
        $scope.selectedRecId.push(rec.id);
        $scope.checkedRec.push(rec);
    }

    this.setCurrentPage = function(currentPage){
        $scope.currentPage = currentPage;
        this.searchRecs();
    };
    this.setLimitPerPage = function(limitPerPage){
        $scope.limitPerPage = limitPerPage;
        this.searchRecs();
    };

    this.exportRecordings = function(listParams) {
        if (a2UserPermit.isSuper()) return this.openExportPopup(listParams)
        if ((a2UserPermit.all && !a2UserPermit.all.length) || !a2UserPermit.can('export report')) {
            return notify.error('You do not have permission to export data');
        }
        this.openExportPopup(listParams)
    };

    this.openExportPopup = function(listParams) {
        $scope.params.userEmail = a2UserPermit.getUserEmail() || '';
        const modalInstance = $modal.open({
            controller: 'ExportRecordingstModalInstanceCtrl',
            templateUrl: '/app/audiodata/export-report.html',
            resolve: {
                data: function() {
                    return { params: $scope.params,  listParams: listParams }
                }
            },
            backdrop: false
        });

        modalInstance.result.then(function() {
            notify.log('Your report export request is processing <br> and will be sent by email.');
        });
    };

})
.controller('SavePlaylistModalInstanceCtrl', function($scope, $modalInstance, a2Playlists, listParams, notify) {
    var result
    $scope.savePlaylist = function(name) {
        $scope.isSavingPlaylist = true
        a2Playlists.create({
            playlist_name: name,
            params: listParams
        },
        function(data) {
            $scope.isSavingPlaylist = false
            if (data.error) {
                $scope.errMess = data.error;
            }
            else {
                result = data
                $modalInstance.close({message: 'Playlist created'});
            }
        });
        var timeout;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            $scope.isSavingPlaylist = false
            $modalInstance.close({message: 'Playlist creating'});
            if (!$scope.errMess && !result) {
                notify.log('Your playlist is being created. <br> Check it in the project playlists');
            }
        }, 60000)
    };
    $scope.changePlaylistName = function() {
        $scope.errMess = null;
    }
})
.controller('ExportRecordingstModalInstanceCtrl', function($scope, $modalInstance, Project, data) {
    $scope.userEmail = data.params.userEmail
    $scope.exportRecordings = function(email) {
        data.params.userEmail = email
        $scope.isExportingRecs = true
        $scope.errMess = ''
        Project.getRecordingData(data.params, data.listParams).then(data => {
            $scope.isExportingRecs = false
            if (data.error) {
                $scope.errMess = data.error;
            }
            else {
                $modalInstance.close();
            }
        })
    }
    $scope.changeUserEmail = function() {
        $scope.errMess = null;
    }
})
.directive("customSrc", function() {
    return {
      link: function(scope, element, attrs) {
        var img, loadImage;
        img = null;

        loadImage = function() {

          element[0].src = '';

          img = new Image();
          img.src = attrs.customSrc;

          img.onload = function() {
            element[0].src = attrs.customSrc;
          };
        };

        scope.$watch((function() {
          return attrs.customSrc;
        }), function(newVal, oldVal) {
          if (oldVal !== newVal) {
            loadImage();
          }
        });
      }
    };
});
