angular.module('audiodata', [
    'a2services', 
    'a2directives', 
    'ui.bootstrap', 
    'angularFileUpload',
    'visualizer-training-sets',
    'humane'
])
.config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.when("/audiodata", "/audiodata/sites");

    $stateProvider.state('audiodata', {
        url: '/audiodata',
        views: {
            'audiodata': {
                templateUrl: '/partials/audiodata/index.html'
            }
        },
        deepStateRedirect: true, 
        sticky: true,
    })
    .state('audiodata.sites', {
        url: '/sites',
        controller:'SitesCtrl',
        templateUrl: '/partials/audiodata/sites.html'
    })
    .state('audiodata.recordings', {
        url: '/recordings',
        controller: 'RecsCtrl',
        templateUrl: '/partials/audiodata/recordings.html'
    })
    .state('audiodata.uploads', {
        url: '/uploads',
        controller: 'UploadCtrl',
        templateUrl: '/partials/audiodata/upload.html'
    })
    .state('audiodata.species', {
        url: '/species',
        controller:'SpeciesCtrl',
        templateUrl: '/partials/audiodata/species.html'
    })
    .state('audiodata.trainingSets', {
        url: '/training-sets',
        controller: 'TrainingSetsCtrl',
        templateUrl: '/partials/audiodata/training-sets.html'
    })
    .state('audiodata.playlists', {
        url: '/playlists',
        controller: 'PlaylistCtrl',
        templateUrl: '/partials/audiodata/playlists.html'
    });
})
.controller('RecsCtrl', function($scope, Project, $http, $modal, a2Playlists, notify) {
    $scope.loading = true;
    
    
    var readFilters = function() {
        $scope.message = '';
        var params = {};
        
        if($scope.params.range && $scope.params.range.from && $scope.params.range.to) {
            params.range = $scope.params.range;
            
            params.range.to.setHours(23);
            params.range.to.setMinutes(59);
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
        params.limit = $scope.limitPerPage;
        params.offset = ($scope.currentPage-1) * $scope.limitPerPage;
        params.sortBy = $scope.sortKey;
        params.sortRev = $scope.reverse;
        params.output = output;
        
        Project.getRecs(params, function(data) {
            if(!output || output === 'list') {
                $scope.recs = data;
            
                $scope.recs.forEach(function(rec) {
                    rec.datetime = new Date(rec.datetime);
                });
                $scope.loading = false;
            }
            else if(output === 'count'){
                $scope.totalRecs = data[0].count;
            }
            else if(output === 'date_range') {
                $scope.minDate = new Date(data[0].min_date);
                $scope.maxDate = new Date(data[0].max_date);
                $scope.years = d3.range($scope.minDate.getFullYear(), ($scope.maxDate.getFullYear() + 1) );
            }
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
    
    $scope.fields = [
        { name: 'Site', key: 'site' },
        { name: 'Time', key: 'datetime' },
        { name: 'Recorder', key: 'recorder' },
        { name: 'Microphone', key: 'mic' },
        { name: 'Software ver', key: 'version' },
        { name: 'Filename', key: 'file' },
    ];
    
    searchRecs('count');
    
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
    
    searchRecs('date_range');
    
    $scope.sortRecs = function(sortKey, reverse) {
        $scope.sortKey = sortKey;
        $scope.reverse = reverse;
        searchRecs();
    };
    $scope.applyFilters = function() {
        $scope.currentPage  = 1;
        searchRecs('count');
        searchRecs();
    };
    $scope.resetFilters = function() {
        $scope.currentPage  = 1;
        $scope.params = {};
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
    
    /* $scope.edit = function() {
        
        if(!$scope.checked || !$scope.checked.length)
            return;
        
        var recorders = $scope.checked.map(function(rec) {
            return rec.recorders
        })
        
        
        
        var modalInstance = $modal.open({
            templateUrl: '/partials/audiodata/edit-recs.html',
            controller: 'RecsEditorCtrl',
            size: 'lg',
            resolve: {
                data: function() {
                    return data;
                }
            }
        });
    } */
})
.controller('SavePlaylistModalInstanceCtrl', function($scope, $modalInstance, a2Playlists, listParams) {
    $scope.errMess = '';
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
// .controller('RecsEditorCtrl', function($scope, Project, $modalInstance, recs) {
//     $scope.recs = recs;
// })
.controller('UploadCtrl', function($scope, uploads, Project, $modal){ 
    $scope.prettyBytes = function(bytes) {
        
        var labels = ['B', 'kB', 'MB', 'GB'];
        
        var newBytes;
        var p;
        
        for(p=1; bytes/Math.pow(1024, p) > 1; p++) {
            newBytes = bytes/Math.pow(1024, p);
        }        
        
        newBytes = Math.round(newBytes*100)/100;
        
        return String(newBytes) + ' ' + labels[--p];
    }; 
    
    
    $scope.verifyAndUpload = function() {
        $scope.uploader.queue.forEach(function(item) {
            
            Project.recExists($scope.info.site.id, item.file.name.split('.')[0], function(exists) {
                if(item.isSuccess) // file uploaded on current batch
                    return;
                
                if(exists) {
                    console.log('duplicated');
                    item.isDuplicate = true;
                    return;
                }
                
                item.formData.push({ info: JSON.stringify($scope.info) });
                item.upload();
            });

        });

    };
      
    $scope.uploader = uploads.getUploader();
    $scope.info = uploads.getBatchInfo();
    
    
    $scope.batchInfo = function() {
        var modalInstance = $modal.open({
            templateUrl: '/partials/audiodata/batch-info.html',
            controller: 'BatchInfoCtrl',
            resolve: {
                info: function() {
                    return $scope.info;
                }
            }
        });
        
        modalInstance.result.then(function(newInfo) {
            uploads.setBatchInfo(newInfo);
            $scope.info = newInfo;
        });
    };
    
    
    Project.getInfo(function(info) {
        $scope.project = info;
        $scope.uploader.url = '/uploads/audio/project/' + info.project_id;
    });
    
    $scope.uploader.filters.push({
        name: 'supportedFormats',
        fn: function(item) {
            var name = item.name.split('.');
            var extension = name[name.length-1];
            
            //~ console.log('format', extension);
            var validFormats = /mp3|flac|wav/i;
            
            if(!validFormats.exec(extension))
                return false;
                
            return true;
        }
    });
    
    $scope.uploader.filters.push({
        name: 'notDuplicate',
        fn: function(item) {
            
            var duplicate = $scope.uploader.queue.filter(function(qItem) {
               return qItem.file.name === item.name; 
            });
                        
            return !duplicate.length;
        }
    });
})
.controller('BatchInfoCtrl', function($scope, Project, info, $modalInstance) {
    
    if(info) {
        $scope.info = angular.copy(info);
    }
    else {
        $scope.info = {};
        $scope.info.format = "Arbimon";
    }
    
    Project.getSites(function(sites) {
        $scope.sites = sites;
    });
    
    
    $scope.close = function(){
        if($scope.uploadInfo.$valid) {
            $modalInstance.close($scope.info);
        }
        
        $scope.error = true;
    };
})
.factory('uploads', function(FileUploader){
    var u = new FileUploader();
    
    var uploadInfo = null;

    window.addEventListener("beforeunload", function (e) {
        if(u.isUploading) {
            var confirmationMessage = "Upload is in progress, Are you sure to exit?";
        
            (e || window.event).returnValue = confirmationMessage;     //Gecko + IE
            return confirmationMessage;                                //Webkit, Safari, Chrome etc.
        }
    });

    
    return {        
        getUploader: function() {
            return u;
        },
        
        getBatchInfo: function() {
            return uploadInfo;
        },
        
        setBatchInfo: function(info) {
            uploadInfo = info;
        }
    };
})
.controller('SitesCtrl', function($scope, Project, $http, $modal, notify) {
    $scope.loading = true;
    
    Project.getInfo(function(info){
        $scope.project = info;
    });
    
    Project.getSites(function(sites) {
        $scope.sites = sites;
        $scope.loading = false;
    });
    
    $scope.editing = false;
    
    $scope.fields = [
        { name: 'Name', key: 'name' },
        { name: 'Latidude', key:'lat' },
        { name: 'Longitude', key: 'lon' },
        { name: 'Altitude', key: 'alt' },
        { name: 'Rec qty', key: 'rec_count' }
    ];
    
    
    var mapOptions = {
        center: { lat: 18.3, lng: -66.5},
        zoom: 8
    };
    
    $scope.map = new google.maps.Map(document.getElementById('map-site'), mapOptions);
    
    
    
    $scope.save = function() {
        var action = $scope.editing ? 'update' : 'create';
        
        $http.post('/api/project/'+ action +'/site', {
            project: $scope.project,
            site: $scope.temp
        })
        .success(function(data) {
            if(data.error)
                notify.error(data.error);
                
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
            console.log(data);
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
    };
    
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
    
    $scope.sel = function(site) {
        //~ console.log('sel');
        
        $scope.editing = false;
        $scope.creating = false;
        
        $scope.selected = site;
        
        var position = new google.maps.LatLng($scope.selected.lat, $scope.selected.lon);
        
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
.controller('SpeciesCtrl', function($scope, Project, Species, Songtypes, $modal, notify) {
    $scope.loading = true;
    
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
        $scope.loading = false;
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
            
            if(result.error) {
                notify.error(result.error);
            }
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
            
    };
})
.factory('a2TrainingSetHistory',
    function(){
        var lastSet, 
            lastPage,
            lastRoi,
            lastRoiSet,
            viewState,
            lastSpecie,
            lastSongtype;
            
        return {
            getLastSet : function(callback)
            {
                callback ({ls:lastSet,lp:lastPage,lr:lastRoi,lrs:lastRoiSet,vs:viewState,sp:lastSpecie,sg:lastSongtype}) ;
            },
            setLastSet : function(val)
            {
                lastSet = val;
            },
            setLastPage: function(val)
            {
                lastPage = val;
            },
            setLastRoi: function(val)
            {
                lastRoi = val;
            },
            setLastRoiSet: function(val)
            {
                lastRoiSet = val;
            },
            setViewState: function(val)
            {
                viewState = val;
            },
            setLastSpecies: function(valsp,valsg)
            {
                lastSpecie = valsp;
                lastSongtype = valsg;
            }
            };
    }
)
.controller('TrainingSetsCtrl', function($scope, a2TrainingSets, Project, $modal, a2TrainingSetHistory) {
    $scope.fields = [
        { name: 'Name', key: 'name' , tdclass :'widthtd hidelongtext' },
        { name: 'Set type', key: 'type' },
        { name: 'Date created', key: 'date_created' },
    ];
    $scope.loading = true;
    $scope.rois = [];
    $scope.selectedName = '';
    $scope.species = '';
    $scope.songtype = '';
    $scope.showSetDetails = false;
    a2TrainingSets.getList(function(data){
        $scope.sets = data.map(function(d) {
            d.date_created = new Date(d.date_created);
            return d;
        });
        $scope.loading = false;
    });
    
    $scope.roi = null;
    $scope.currentrois = [];
    $scope.currentPage = 0;
    $scope.roisPerpage = 12;
    $scope.currentRoi = 0;
    $scope.totalRois = 0;
    $scope.currentUri = '';
    $scope.totalpages = 0;
    $scope.detailedView = false;
    $scope.currentDuration = 0;
    $scope.currentlow = 0;
    $scope.currenthigh = 0;
    $scope.currentId = 0;
    $scope.currentUrl = '';
    $scope.norois = false;
    $scope.toggleView = function ()
    {
        if ($scope.detailedView)
        {
            $scope.detailedView = false;
        }
        else
        {
            $scope.detailedView = true;
        }
    };
    
    $scope.next = function ()
    {
        $scope.currentRoi = $scope.currentRoi + 1;
        if ($scope.currentRoi >= $scope.totalRois) {
            $scope.currentRoi = $scope.currentRoi - 1;
        }
        else
        {
            $scope.roi = $scope.rois[$scope.currentRoi];
            $scope.currentDuration = $scope.roi.dur;
            $scope.currentlow = $scope.roi.y1;
            $scope.currenthigh = $scope.roi.y2;
            $scope.currentId = $scope.roi.id;
            $scope.currentUri = $scope.roi.uri;
            $scope.currentUrl = "/project/"+$scope.projecturl+"/#/visualizer/rec/"+$scope.roi.recording;
        }
    };
    
    $scope.prev = function ()
    {
        $scope.currentRoi = $scope.currentRoi- 1;
        if ($scope.currentRoi  < 0) {
            $scope.currentRoi = 0;
        }
        else
        {
            $scope.roi = $scope.rois[$scope.currentRoi];
            $scope.currentDuration = $scope.roi.dur;
            $scope.currentlow = $scope.roi.y1;
            $scope.currenthigh = $scope.roi.y2;
            $scope.currentId = $scope.roi.id;
            $scope.currentUri = $scope.roi.uri;
            $scope.currentUrl = "/project/"+$scope.projecturl+"/#/visualizer/rec/"+$scope.roi.recording;
        }
    };
    
    $scope.nextPage = function ()
    {
        $scope.currentPage = $scope.currentPage + 1;
        if ($scope.currentPage*$scope.roisPerpage >= $scope.totalRois) {
            $scope.currentPage= $scope.currentPage - 1;
        }
        else
        {
            $scope.currentrois = $scope.rois.slice( 
                ($scope.currentPage ) * $scope.roisPerpage, 
                ($scope.currentPage+1) * $scope.roisPerpage
            );
        }
    };
    
    $scope.prevPage = function ()
    {
        $scope.currentPage = $scope.currentPage- 1;
        if ($scope.currentPage*$scope.roisPerpage  < 0) {
            $scope.currentPage = 0;
        }
        else
        {
            $scope.currentrois = $scope.rois.slice(
                ($scope.currentPage ) * $scope.roisPerpage, 
                ($scope.currentPage+1) * $scope.roisPerpage
            );
        }
    };
    
    $scope.removeRoi = function(id)
    {
        a2TrainingSets.removeRoi(id,$scope.selectedSet,function(data){
            if (data.affectedRows) 
            {
                for(var i = 0 ; i < $scope.rois.length ; i++)
                {
                    if ($scope.rois[i].id == id){
                        $scope.rois.splice(i,1);
                        break;
                    }
                }

                if ($scope.currentRoi >= $scope.rois.length) {
                    $scope.currentRoi = $scope.rois.length -1;
                }
                $scope.totalRois = $scope.rois.length;
                if ($scope.totalRois>0) {
                
                    $scope.roi = $scope.rois[$scope.currentRoi];
                    $scope.currentDuration = $scope.roi.dur;
                    $scope.currentlow = $scope.roi.y1;
                    $scope.currenthigh = $scope.roi.y2;
                    $scope.currentId = $scope.roi.id;
                    $scope.currentUrl = "/project/"+$scope.projecturl+"/#/visualizer/rec/"+$scope.roi.recording;
                    $scope.currentUri = $scope.roi.uri;
                    $scope.totalpages = Math.ceil( $scope.totalRois/$scope.roisPerpage);
                    if($scope.currentPage>($scope.totalpages-1)){
                        $scope.currentPage = $scope.totalpages-1;
                    }
                    $scope.currentrois =  $scope.rois.slice(
                        ($scope.currentPage ) * $scope.roisPerpage, 
                        ($scope.currentPage+1) * $scope.roisPerpage
                    );
                }else {$scope.rois = [];$scope.norois = true;}
            }
        });
    };
 
    Project.getInfo(function(info) {
        $scope.projecturl = info.url;
    });
 
    $scope.closeSetDetails = function()
    {
       $scope.showSetDetails = false;
    };
    
    $scope.add_new_tset = function(){
        $modal.open({
            templateUrl : '/partials/visualizer/modal/add_tset.html',
            controller  : 'a2VisualizerAddTrainingSetModalController'
        }).result.then(function (new_tset) {
            a2TrainingSets.getList(function(data){
                $scope.sets = data.map(function(d) {
                    d.date_created = new Date(d.date_created);
                    return d;
                });
            });
        });
    };

    a2TrainingSetHistory.getLastSet(
        function(data)
        {
            if (data.ls)
            {
                $scope.showSetDetails = true;
                $scope.selectedSet = data.ls;
                $scope.selectedName = $scope.selectedSet.name;
                $scope.species = data.sp;
                $scope.songtype = data.sg;
                $scope.detailedView = data.vs;
                $scope.totalRois = data.lrs.length;
                $scope.currentPage = data.lp;
                $scope.totalpages = Math.ceil( $scope.totalRois/$scope.roisPerpage);
                
                if ($scope.totalRois>0) {
                    if (data.lr === undefined){
                        data.lr = 0;
                    }
                    $scope.roi = data.lrs[data.lr];
                    $scope.currentDuration = $scope.roi.dur;
                    $scope.currentRoi = data.lr;
                    $scope.currentUrl = "/project/"+$scope.projecturl+"/#/visualizer/rec/"+$scope.roi.recording;
                    $scope.currentUri = $scope.roi.uri;
                    $scope.currentlow = $scope.roi.y1;
                    $scope.currenthigh = $scope.roi.y2;
                    $scope.currentId = $scope.roi.id;
                    $scope.currentrois = data.lrs.slice(
                        ($scope.currentPage ) * $scope.roisPerpage, 
                        ($scope.currentPage+1) * $scope.roisPerpage
                    );
                    $scope.rois = data.lrs;
                } else { 
                    $scope.rois = []; 
                    $scope.norois = true;
                }
            }
        }
    );
    
    $scope.$watch('detailedView',
        function()
        {
            a2TrainingSetHistory.setViewState($scope.detailedView);          
        }
    );
     
    $scope.$watch('currentPage',
        function()
        {
            a2TrainingSetHistory.setLastPage($scope.currentPage);          
        }
    );
    
    $scope.$watch('currentRoi',
        function()
        {
            a2TrainingSetHistory.setLastRoi($scope.currentRoi);          
        }
    );
    
    $scope.$watch('rois',
        function()
        {
            a2TrainingSetHistory.setLastRoiSet($scope.rois);          
        }
    );
    $scope.loaderDisplay = false;

    $scope.displaySetData = function($object) {
        var setId = $object.id;
        var i = 0;
        while(i < $scope.sets.length)
        {
            if ($scope.sets[i].id == setId )
            {
               break;
            }else i++;   
        }
        var setIndex = i;
        $scope.showSetDetails = true;
        $scope.norois = false;
        $scope.loaderDisplay = true;
        a2TrainingSetHistory.setLastSet($scope.sets[setIndex]);
        $scope.selectedSet = $scope.sets[setIndex];
        $scope.selectedName = $scope.sets[setIndex].name;
        $scope.species  = null;
        $scope.songtype = null;
        $scope.detailedView    = undefined;
        $scope.totalRois       = undefined;
        $scope.currentPage     = undefined;
        $scope.totalpages      = undefined;
        $scope.roi             = undefined;
        $scope.currentDuration = undefined;
        $scope.currentRoi      = undefined;
        $scope.currentUrl      = undefined;
        $scope.currentUri      = undefined;
        $scope.currentlow      = undefined;
        $scope.currenthigh     = undefined;
        $scope.currentId       = undefined;
        $scope.currentrois     = undefined;
        $scope.rois            = undefined;
        a2TrainingSets.getSpecies($scope.sets[setIndex].name, function(speciesData){
            $scope.species = speciesData[0].species;
            $scope.songtype = speciesData[0].songtype;
        
            a2TrainingSetHistory.setLastSpecies($scope.species,$scope.songtype);
        
            a2TrainingSets.getRois($scope.sets[setIndex].name, function(data){
                $scope.loaderDisplay = false;
                $scope.detailedView = false;
                $scope.totalRois = data.length;
                $scope.currentPage = 0;
                $scope.totalpages = Math.ceil( $scope.totalRois/$scope.roisPerpage);
                if ($scope.totalRois>0) {
                    $scope.roi = data[0];
                    $scope.currentDuration = $scope.roi.dur;
                    $scope.currentRoi = 0;
                    $scope.currentUrl = "/project/"+$scope.projecturl+"/#/visualizer/rec/"+$scope.roi.recording;
                    $scope.currentUri = $scope.roi.uri;
                    $scope.currentlow = $scope.roi.y1;
                    $scope.currenthigh = $scope.roi.y2;
                    $scope.currentId = $scope.roi.id;
                    $scope.currentrois = data.slice(
                        ($scope.currentPage ) * $scope.roisPerpage, 
                        ($scope.currentPage+1) * $scope.roisPerpage
                    );
                    $scope.rois = data;
                } else { 
                    $scope.rois = []; 
                    $scope.norois = true;
                }
            });
        });
    };
})
.controller('PlaylistCtrl', function($scope, a2Playlists, $modal, notify) {
    $scope.loading = true;
    
    $scope.fields = [
        { name: 'Name', key: 'name' },
        { name: 'Rec qty', key: 'count' }
    ];
    
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
        
        $scope.messages = message.concat(playlists, message2);
        
        $scope.btnOk = "Yes, do it!";
        $scope.btnCancel = "No";
        
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
