angular.module('a2.analysis.audio-event-detections-clustering', [
  'ui.bootstrap',
  'a2.srv.audio-event-detections-clustering',
  'a2.services',
  'a2.permissions',
  'humane',
  'a2.directive.error-message'
])
.config(function($stateProvider) {
    $stateProvider
        .state('analysis.audio-event-detections-clustering', {
            url: '/audio-event-detections-clustering?newJob',
            controller: 'AudioEventDetectionsClusteringModelCtrl',
            templateUrl: '/app/analysis/audio-event-detections-clustering/list.html'
        })
})
.controller('AudioEventDetectionsClusteringModelCtrl' , function($scope, $modal, $location, JobsData, notify, a2AudioEventDetectionsClustering, Project, $localStorage, $window, a2UserPermit, $state) {

    var p = $state.params;
    var isNewJob = p && p.newJob !== undefined;

    $scope.loadAudioEventDetections = function() {
        $scope.loading = true;
        $scope.showRefreshBtn = false;
        $scope.projectUrl = Project.getUrl();

        return a2AudioEventDetectionsClustering.list({
            user: true,
            dataExtended: true,
            completed: true,
            aedCount: true
        }).then(function(data) {
            $scope.audioEventDetectionsOriginal = data;
            $scope.audioEventDetectionsData = data;
            $scope.loading = false;
            if (data && data.length) {
                $scope.showRefreshBtn = true;
            }
        });
    };

    $scope.loadAudioEventDetections();

    $scope.tieringGuard = { loading: true };

    this.loadTieringData = function() {
        $scope.tieringGuard.loading = true;
        Project.getAnalysisTieringGuard()
            .then(function(guard) {
                $scope.tieringGuard = angular.extend({ loading: false }, guard);
            })
            .catch(function() {
                $scope.tieringGuard.loading = false;
            });
    };

    this.loadTieringData();

    $scope.onSelectedJob = function(playlist_id, job_id, first_playlist_recording) {
        $localStorage.setItem('analysis.audioEventJob',  job_id);
        $window.location.href = '/p/' + Project.getUrl() + '/visualizer/playlist/' + playlist_id + '/' + first_playlist_recording;
    }

    $scope.createNewClusteringModel = function () {
        if(!a2UserPermit.can('manage AED and Clustering job')) {
            notify.error('You do not have permission to create <br> Audio Event Detection job');
            return;
        }

        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/audio-event-detections-clustering/new-audio-event-detection-clustering.html',
            controller: 'CreateNewAudioEventDetectionClusteringCtrl as controller',
            windowClass: 'modal-element width-700'
        });

        modalInstance.result.then(function (result) {
            data = result;
            if (data.create) {
                JobsData.updateJobs();
                $scope.showRefreshBtn = true
                notify.log("Your new Audio Event Detection Clustering model is waiting to start processing.<br> Check its status on <b>Jobs</b>.");
            } else if (data.error) {
                notify.error("Error: "+data.error);
            } else if (data.url) {
                $location.path(data.url);
            }
        });
    };

    if (isNewJob) {
        $scope.createNewClusteringModel()
    }

    $scope.deleteAedJob = function(aedJob, $event) {
        $event.stopPropagation();
        // Prevent delete job for the user/expert roles.
        if(!a2UserPermit.can('manage AED and Clustering job') || (a2UserPermit.can('manage AED and Clustering job') && !a2UserPermit.can('export report'))) {
            notify.error('You do not have permission to delete <br> Audio Event Detection job');
            return;
        }

        var modalInstance = $modal.open({
            templateUrl: '/app/analysis/audio-event-detections-clustering/delete-audio-event-detection-clustering-job.html',
            controller: 'DeleteAedJobCtrl as controller',
            resolve: {
                aedJob: function() {
                    return aedJob;
                },
            },
            windowClass: 'modal-element width-490'
        });

        modalInstance.result.then(function(ret) {
            if (ret.err) {
                notify.error('Error: ' + ret.err);
            } else {
                const modArr = angular.copy($scope.audioEventDetectionsOriginal);
                const indx = modArr.findIndex(item => item.job_id === aedJob.job_id);
                if (indx > -1) {
                    $scope.audioEventDetectionsOriginal.splice(indx, 1);
                    notify.log('Audio Event Detection Job deleted successfully');
                }
            }
        });
    };
})

.controller('DeleteAedJobCtrl',
    function($scope, $modalInstance, a2AudioEventDetectionsClustering, aedJob) {
        this.aedJob = aedJob;
        $scope.deletingloader = false;

        $scope.ok = function() {
            $scope.deletingloader = true;
            a2AudioEventDetectionsClustering.delete(aedJob.job_id).then(function(data) {
                $modalInstance.close(data);
            });
        };

        $scope.cancel = function() {
            $modalInstance.dismiss('cancel');
        };
    }
)
.controller('CreateNewAudioEventDetectionClusteringCtrl', function($modalInstance, a2AudioEventDetectionsClustering, a2Playlists, a2UserPermit, notify, Project) {
    Object.assign(this, {
        initialize: function(){
            this.loading = {
                playlists: false
            };

            this.details = { show: false }

            var list = this.list = {};

            this.data = {
                name: null,
                playlist: null,
                params: {
                    areaThreshold: 1,
                    amplitudeThreshold: 1,
                    durationThreshold: 0.2,
                    bandwidthThreshold: 0.5,
                    filterSize: 10,
                    minFrequency: 0,
                    maxFrequency: 24
                }
            };
            // rfcx-local §476 (2026-10-18): the frequency box used to be a hard-coded
            // 0-24 kHz whatever the playlist held (and, since 2026-05-28, was not even
            // sent to the worker). Now the limit AND the default Max follow the selected
            // playlist's Nyquist (max sample_rate / 2). `band.nyquist_khz` null = unknown
            // (empty playlist or lookup failed) -> fall back to the old 24 so the form
            // still works; the server treats an out-of-band max as "clamp to Nyquist".
            this.band = { nyquist_khz: null, n_rates: 0, loading: false, playlistId: null };
            this.DEFAULT_MAX_KHZ = 24;
            // 2026-10-21 (rfcx-local §476 follow-up): the BAT / ULTRASONIC preset is OPT-IN.
            // Measured on a 250 kHz bat project (FINDING-2026-10-21-aed-advanced-params-
            // bat-evaluation): the defaults caught ~69 % of injected bat calls and merged a
            // whole pass into one event (Filter Size 10 smooths over ~100 ms); this preset
            // caught ~98 % at ~1 event per call. It is NOT applied automatically: 96 kHz
            // recorders are common on audible-range (bird/frog) projects (80 AED jobs since
            // 2024, median requested Max 24 kHz), and a 15 kHz Min would silently drop
            // everything they recorded. So the button only appears when the playlist CAN
            // hold ultrasound (Nyquist > 24), and the user chooses it.
            this.ULTRASONIC_PRESET = {
                minFrequency: 15,
                amplitudeThreshold: 1,
                durationThreshold: 0.01,
                bandwidthThreshold: 3,
                areaThreshold: 0.02,
                filterSize: 2
            };
            this.presetApplied = false;

            this.isRfcxUser = a2UserPermit.isRfcx();
            this.isSuper = a2UserPermit.isSuper();
            this.errorJobLimit = false;
            this.tieringGuard = { loading: true, isBlocked: false, isJobLimitReached: false, isViewOnlyBlocked: false, settingsUrl: '' };

            Project.getAnalysisTieringGuard().then((function(guard) {
                this.tieringGuard = Object.assign({ loading: false }, guard);
            }).bind(this)).catch((function() {
                this.tieringGuard.loading = false;
            }).bind(this));

            this.loading.playlists = true;
            a2Playlists.getList().then((function(playlists){
                this.loading.playlists = false;
                list.playlists = playlists;
            }).bind(this));
        },

        isRfcx: function () {
            return this.isRfcxUser || this.isSuper
        },

        checkLimit: function(count) {
            return count > 10000 && !this.isRfcx()
        },

        toggleDetails: function() {
            this.details.show = !this.details.show
        },

        newJob: function () {
            try {
                return a2AudioEventDetectionsClustering.create({
                    playlist_id: this.data.playlist.id,
                    name: this.data.name,
                    params: this.data.params
                }).then(function(clusteringModel) {
                    $modalInstance.close({ create: true, clusteringModel: clusteringModel })
                }).catch(notify.serverError);
            } catch(error) {
                console.error('a2AudioEventDetectionsClustering.create error: ' + error);
            }
        },

        create: function () {
            this.errorJobLimit = false
            if (this.tieringGuard.isBlocked) return
            if (this.isRfcx()) return this.newJob()
            return a2AudioEventDetectionsClustering.count().then(data => {
                if (this.checkLimit(data.totalRecordings)) {
                    this.errorJobLimit = true
                    return
                } else this.newJob()
            })
        },

        cancel: function (url) {
            $modalInstance.close({ cancel: true, url: url });
        },

        isUltrasonicPlaylist: function () {
            var n = this.band && this.band.nyquist_khz;
            return !!(n && isFinite(n) && n > this.DEFAULT_MAX_KHZ);
        },
        // Fills the preset (and Max = this playlist's Nyquist) and opens Advanced
        // Parameters so the user SEES every value that changed. Nothing is hidden.
        applyUltrasonicPreset: function () {
            if (!this.isUltrasonicPlaylist()) return;
            var params = this.data.params;
            var preset = this.ULTRASONIC_PRESET;
            Object.keys(preset).forEach(function (k) { params[k] = preset[k]; });
            params.maxFrequency = this.maxKhz();
            this.details.show = true;
            this.presetApplied = true;
        },

        // Per-field rule for the advanced parameters, so the error names the field
        // and its limit (2026-10-21; the old single sentence named neither, and a
        // user could not tell which box was wrong). Returns [] when all valid.
        ADVANCED_PARAM_RULES: [
            { key: 'durationThreshold', label: 'Duration Threshold', min: 0.01 },
            { key: 'bandwidthThreshold', label: 'Bandwidth Threshold', min: 0.01 },
            { key: 'areaThreshold', label: 'Area Threshold', min: 0.01 },
            { key: 'filterSize', label: 'Filter Size', min: 2 }
        ],
        advancedParamErrors: function () {
            if (!this.data || !this.data.params) return [];
            var params = this.data.params;
            return this.ADVANCED_PARAM_RULES.filter(function (r) {
                var v = params[r.key];
                return v === undefined || v === null || v === '' || !isFinite(Number(v)) || Number(v) < r.min;
            }).map(function (r) {
                return r.label + ' must be a number of at least ' + r.min +
                    ' (an empty box usually means the value typed was below that).';
            });
        },

        // The five "Advanced Parameters". These are sent to the worker as
        // `Number(value)`, so an undefined/blank field becomes NaN -> JSON null
        // -> the AED worker dies on float(None) and the job poison-loops.
        // They must therefore be validated here, exactly like the frequencies.
        ADVANCED_PARAM_KEYS: ['durationThreshold', 'bandwidthThreshold',
            'areaThreshold', 'filterSize'],

        // True when any advanced param is missing or not a finite positive
        // number. Drives both the submit guard and the inline error message.
        showAdvancedParamWarning: function () {
            return this.advancedParamErrors().length > 0;
        },

        isJobValid: function () {
            return this.data && this.data.name && this.data.name.length > 3 && this.data.playlist &&
                !this.isNotDefined(this.data.params.maxFrequency) && !this.isNotDefined(this.data.params.minFrequency) &&
                // Advanced params are optional to EDIT (they carry defaults) but
                // must never reach the worker as null -- see 2026-08-09 incident
                // (jobs 168742/168743/168746/168748).
                !this.showAdvancedParamWarning();
        },

        showNameWarning: function () {
            return this.data && this.data.name && this.data.name.length > 1 && this.data.name.length < 4
        },

        isProjectHasAccess: function () {
            const projectUrl = Project.getUrl();
            const accessedProjects = ['pogije'];
            return accessedProjects.includes(projectUrl)
        },


        showPlaylistLimitWarning: function () {
            if (!this.data && !this.data.playlist) return
            return this.data && this.data.playlist && this.data.playlist.count > 2000 && !this.isRfcx() && !this.isProjectHasAccess()
        },

        showFrequencyWarning: function () {
            return this.data.params.maxFrequency <= this.data.params.minFrequency
        },
        // §476: the ceiling the inputs enforce (kHz). Nyquist when known, else 24.
        maxKhz: function () {
            var n = this.band && this.band.nyquist_khz;
            return (n && isFinite(n) && n > 0) ? n : this.DEFAULT_MAX_KHZ;
        },
        showNyquistWarning: function () {
            return this.data && this.data.params && isFinite(Number(this.data.params.maxFrequency)) &&
                Number(this.data.params.maxFrequency) > this.maxKhz();
        },
        isMixedRatePlaylist: function () {
            return !!(this.band && this.band.n_rates > 1);
        },
        // Called when the playlist selection changes: fetch its band, then move the
        // Max to the new Nyquist if the user has not typed their own value (i.e. it
        // still equals the previous ceiling or the old default).
        onPlaylistChange: function (playlist) {
            if (!playlist || !playlist.id) return;
            var prevCeiling = this.maxKhz();
            this.band.loading = true;
            this.band.playlistId = playlist.id;
            a2AudioEventDetectionsClustering.playlistBand(playlist.id).then((function (band) {
                if (this.band.playlistId !== playlist.id) return;   // a later selection won
                this.band.nyquist_khz = band && band.nyquist_khz ? Number(band.nyquist_khz) : null;
                this.band.n_rates = band && band.n_rates ? Number(band.n_rates) : 0;
                this.band.loading = false;
                var cur = Number(this.data.params.maxFrequency);
                if (!isFinite(cur) || cur === prevCeiling || cur === this.DEFAULT_MAX_KHZ || cur > this.maxKhz()) {
                    this.data.params.maxFrequency = this.maxKhz();
                }
            }).bind(this)).catch((function () {
                this.band.loading = false;          // fail-open: keep the 24 fallback
            }).bind(this));
        },

        isNotDefined: function (item) {
            return item === undefined || item === null
        },

        isCreateBlocked: function () {
            return this.tieringGuard.loading || this.tieringGuard.isBlocked
        }
    });
    this.initialize();
})
