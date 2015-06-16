angular.module('a2.audiodata.recordings', [
    'a2.services', 
    'a2.directives', 
    'ui.bootstrap',
    'humane'
])
.controller('RecsCtrl', function($scope, Project, $http, $modal, notify) {
    $scope.loading = true;
    
    
    var readFilters = function() {
        $scope.message = '';
        var params = {};
        
        if($scope.params.range && $scope.params.range.from && $scope.params.range.to) {
            params.range = $scope.params.range;
            
            params.range.from.setUTCHours(0);
            params.range.from.setUTCMinutes(0);
            params.range.to.setUTCHours(23);
            params.range.to.setUTCMinutes(59);
        }
    
        if($scope.params.sites && $scope.params.sites.length)
            params.sites = $scope.params.sites.map(function(site) { return site.name; });
        
        if($scope.params.hours && $scope.params.hours.length) 
            params.hours = $scope.params.hours.map(function(h) { return h.value; });
        
        if($scope.params.months && $scope.params.months.length)
            params.months = $scope.params.months.map(function(m) { return m.value; });
        
        if($scope.params.years && $scope.params.years.length)
            params.years = $scope.params.years;
            
        if($scope.params.days && $scope.params.days.length)
            params.days = $scope.params.days;
        
        return params;
    };
    var searchRecs = function(output) {
        var params = readFilters();
        params.output = output || 'list';
        params.limit = $scope.limitPerPage;
        params.offset = (params.output == 'list') ? ($scope.currentPage-1) * $scope.limitPerPage : 0;
        params.sortBy = $scope.sortKey;
        params.sortRev = $scope.reverse;
        
        Project.getRecs(params, function(data) {
            if(params.output == 'list') {
                $scope.recs = data;
            
                $scope.recs.forEach(function(rec) {
                    rec.datetime = new Date(rec.datetime);
                });
                $scope.loading = false;
            }
            else if(params.output == 'count'){
                $scope.totalRecs = data[0].count;
            }
            else if(params.output == 'date_range') {
                $scope.minDate = new Date(data[0].min_date);
                $scope.maxDate = new Date(data[0].max_date);
                $scope.years = d3.range($scope.minDate.getFullYear(), ($scope.maxDate.getFullYear() + 1) );
            }
        });
    };
    $scope.sortRecs = function(sortKey, reverse) {
        $scope.sortKey = sortKey;
        $scope.reverse = reverse;
        searchRecs();
    };
    $scope.applyFilters = function() {
        $scope.currentPage = 1;
        searchRecs('count');
        searchRecs();
    };
    $scope.resetFilters = function() {
        $scope.currentPage = 1;
        $scope.params = {};
        searchRecs('count');
        searchRecs();
    };
    $scope.reloadList = function() {
        searchRecs('count');
        searchRecs();
    };
    $scope.createPlaylist = function() {
        var listParams = readFilters();
        
        if($.isEmptyObject(listParams))
            return;
        
        var modalInstance = $modal.open({
            controller: 'SavePlaylistModalInstanceCtrl',
            templateUrl: '/partials/audiodata/create-playlist.html',
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
    $scope.del = function() {
            
        var recs = $scope.checked.filter(function(rec){ 
                return !rec.imported; 
            });
            
        if(!recs || !recs.length)
            return notify.log('Recordings from imported sites can not be deleted');
        
        var recCount = {};
        
        for(var i = 0; i < recs.length; i++) {
            recCount[recs[i].site] = recCount[recs[i].site] + 1 || 1;
        }
        
        var sites = Object.keys(recCount).map(function(site) {
            var s = recCount[site] > 1 ? 's' : '';
            
            return recCount[site] + ' recording'+s+' from "' + site + '"';
        });
        
        
        var msg = ["You are about to delete: "];
        msg = msg.concat(sites);
        msg.push("Are you sure??");
        
        var modalInstance = $modal.open({
            templateUrl: '/partials/pop-up.html',
            controller: function() {
                this.messages = msg;
                this.btnOk =  "Yes";
                this.btnCancel =  "No, cancel";
            },
            controllerAs: 'popup'
        });
        
        modalInstance.result.then(function() {
            
            var recIds = recs.map(function(rec) { return rec.id; });
            
            $http.post('/api/project/'+Project.getUrl()+'/recordings/delete', { recs: recs })
                .success(function(data) {
                    if(data.error)
                        return notify.error(data.error);
                    
                    searchRecs('count');
                    $scope.recs = $scope.recs.filter(function(rec) {
                        return data.deleted.indexOf(rec.id) === -1;
                    });
                    
                    notify.log(data.msg);
                });
        });
    };
    $scope.params = {};
    $scope.sites = [];
    $scope.years = [];
    $scope.loading = true;
    $scope.currentPage  = 1;
    $scope.limitPerPage = 10;
    $scope.days = d3.range(1,32);
    
    $scope.months =  d3.range(12).map(function(month) {
        return { value: month, string: moment().month(month).format('MMM') };
    });
    
    $scope.hours = d3.range(24).map(function(hour) {
        return { value: hour, string: moment().hour(hour).minute(0).format('HH:mm') };
    });
    
    Project.getSites(function(data){
        $scope.sites = data;
    });
    
    searchRecs('count');
    searchRecs('date_range');
    
    $scope.$watch(function(scope) {
        return [
            $scope.currentPage,
            $scope.limitPerPage
        ];
    }, 
    function(){
        searchRecs();
    }, 
    true);
    
    
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
