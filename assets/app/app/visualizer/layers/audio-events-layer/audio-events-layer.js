angular.module('a2.visualizer.layers.audio-events-layer', [
])
.config(function(layer_typesProvider){
    layer_typesProvider.addLayerType({
        type: "audio-events-layer",
        title: "",
        controller: 'a2VisualizerAudioEventsController as audio_events',
        require: {
            type: ['recording'],
            selection: true
        },
        visible: true,
        hide_visibility: true
    });
})
.controller('a2VisualizerAudioEventsController', function($scope, a2AudioEventDetectionsClustering, a2ClusteringJobs, $localStorage){
    var self = this;
    const colors = ['#5340ff33', '#008000', '#ffcd00', '#1F57CC', '#53ff40', '#5bc0de', '#5340ff33']
    self.audioEvents = null;
    self.clusteringEvents = null;
    self.isAudioEventsPlaylist = null;
    self.selectedAudioEventJob = null;
    self.clusterPlaylists = null;
    self.isPlaylist = false;
    self.toggleAudioEvents = function(isJobsBoxes, id, opacity) {
        (isJobsBoxes? self.audioEvents : self.clusteringEvents).forEach(item => {
            if ((isJobsBoxes? item.job_id : item.playlist_id) === id) {
                item.opacity = opacity === false ? 0 : 1;
                if (isJobsBoxes) {
                    const index = Object.keys(self.audioEventJobs).findIndex(job => Number(job) === item.job_id);
                    const color = colors[index]
                    item.borderColor = self.hexToRGB(color, 0.6)
                    item.backgroundColor = self.hexToRGB(color, 0.2)
                }
            }
        })
        // Remove default/selected job from the audio events details page.
        if (isJobsBoxes) {
            $localStorage.setItem('analysis.audioEventJob', null);
        }
    };
    self.hexToRGB = function(hex, opacity) {
        var r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + opacity + ')';
    }

    self.isHighlightTitle = function() {
        return !isNaN($localStorage.getItem('analysis.audioEventJob'))
    }

    self.fetchAudioEvents = function() {
        var rec = $scope.visobject && ($scope.visobject_type == 'recording') && $scope.visobject.id;
        if (rec) {
            self.isPlaylist = $scope.visobject.extra && $scope.visobject.extra.playlist;
            // Check local storage on selected job from the audio events details page.
            try {
                self.selectedAudioEventJob = $localStorage.getItem('analysis.audioEventJob');
                self.isAudioEventsPlaylist = !isNaN(self.selectedAudioEventJob);
            } catch (e) {}
            // Get Detections Jobs data.
            a2AudioEventDetectionsClustering.list({ rec_id: rec, completed: true }).then(function(audioEvents) {
                if (audioEvents) {
                    self.audioEventJobs = {};
                    // Collect detections jobs data for audio events layer.
                    if (audioEvents.length) {
                        audioEvents.forEach(event => {
                            if (!self.audioEventJobs[event.job_id]) {
                                self.audioEventJobs[event.job_id] = {
                                    job_id: event.job_id,
                                    name: event.name, count: 1,
                                    parameters: event.parameters,
                                    visible: self.isAudioEventsPlaylist? Number(self.selectedAudioEventJob) === event.job_id : false // Job not visible by default, except selected job from the audio events details page.
                                };
                            };
                            self.audioEventJobs[event.job_id].count += 1;
                        });
                    }
                    self.audioEvents = audioEvents.map(event => {
                        return {
                            rec_id: event.rec_id,
                            x1: event.time_min,
                            x2: event.time_max,
                            y1: event.freq_min,
                            y2: event.freq_max,
                            job_id: event.job_id || null,
                            display: event.rec_id === rec? "block" : "none",
                            opacity: self.isAudioEventsPlaylist ? (Number(self.selectedAudioEventJob) === event.job_id ? 1 : 0) : 0 // Boxes not visible by default, except selected job from the audio events details page.
                        }
                    });
                    a2ClusteringJobs.getRoisDetails({rec_id: $scope.visobject.id}).then(function(clusteringEvents) {
                        if (clusteringEvents) {
                            // Collect clustering playlists for audio events layer.
                            self.clusterPlaylists = {};
                            clusteringEvents.forEach(event => {
                                if (!self.clusterPlaylists[event.playlist_id]) {
                                    self.clusterPlaylists[event.playlist_id] = {
                                        rec_id: event.recording_id,
                                        playlist_name: event.playlist_name,
                                        playlist_id: event.playlist_id,
                                        count: 1,
                                        visible: false // Playlist is hidden by default.
                                    };
                                };
                                self.clusterPlaylists[event.playlist_id].count += 1;
                            });
                            self.clusteringEvents = clusteringEvents.map(event => {
                                return {
                                    rec_id: event.recording_id,
                                    x1: event.time_min,
                                    x2: event.time_max,
                                    y1: event.frequency_min,
                                    y2: event.frequency_max,
                                    playlist_id: event.playlist_id || null,
                                    display: event.recording_id === rec? "block" : "none",
                                    opacity: 0 // Boxes not visible by default.
                                }
                            });
                        }
                    })
                }
            });
        }
    };
    $scope.$watch('visobject', self.fetchAudioEvents);
});
