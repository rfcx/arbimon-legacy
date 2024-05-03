angular.module('a2.audiodata.recordings.data-export-parameters', [
    'a2.directive.a2-auto-close-on-outside-click',
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'humane',
    'a2.directive.error-message'
])
.directive('recordingDataExportParameters', function($document, $rootScope){
    return {
        restrict:'E',
        templateUrl:'/app/audiodata/recordings/export-parameters.html',
        scope:{
            onExport : '&'
        },
        controller:'recordingDataExportParametersController as controller',
        requires:'^RecsCtrl',
        link: function(scope, element, attrs, controller) {
            controller.initialize({
                onExport: function(parameters){
                    scope.onExport({parameters: parameters});
                }
            });
        }
    };
})
.service('recordingDataFieldTypes', function(){
    return [
        {   title:'Recording fields',
            identifier:'recording',
            placeholder: 'filename, site, ...',
            list:[
                {value:'filename'  , caption:'Filename'  , tooltip:'The recording filename'  },
                {value:'site'      , caption:'Site'      , tooltip:'The recording site'      },
                {value:'day'       , caption:'Day'       , tooltip:'The recording day'       },
                {value:'hour'      , caption:'Hour'      , tooltip:'The recording hour'      },
                {value:'url'       , caption:'Url'       , tooltip:'The recording URl'       }
            ],
            preselected:['filename', 'site', 'day']
        },
        {   title:'Validations by species/song type',
            identifier:'validation',
            placeholder: 'Species - Sound...',
            getList: function(Project){
                return Project.getClasses({
                    validations: true,
                }).then(function(classes){
                    return classes.map(function(cls){
                        return {value:cls.id, caption:cls.species_name + ' - ' + cls.songtype_name, badges:[
                            {icon:'val-1', value:cls.vals_present},
                            {icon:'val-0', value:cls.vals_absent},
                        ]};
                    });
                });
            },
        },
        {   title:'Soundscape Composition',
            identifier:'soundscapeComposition',
            placeholder: 'Wind, Birds, ...',
            getList: function(a2SoundscapeCompositionService){
                return a2SoundscapeCompositionService.getClassList({isSystemClass:1}).then(function(classes){
                    return classes.map(function(cls){
                        return {value:cls.id, caption:cls.name, group:cls.type};
                    });
                });
            },
        },
        {   title:'Tags',
            identifier:'tag',
            placeholder: 'Tags...',
            getList: function(a2Tags){
                return a2Tags.getForType('recording').then((function(tags){
                    return tags.map(function(tag){
                        return {value:tag.tag_id, caption:tag.tag, icon:'fa-tag', badges:[
                            {value:tag.count}
                        ]};
                    });
                }).bind(this));
            },
        },
        {   title:'Grouping of Detections',
            identifier:'grouped',
            placeholder: 'Detections grouped by...',
            list: [
                {value:'site', caption:'Site', tooltip:'Detections grouped by Site'},
                {value:'hour', caption:'Hour', tooltip:'Detections grouped by Hour'},
                {value:'date', caption:'Date', tooltip:'Detections grouped by Date'},
            ],
        },
        {   title:'Species detection matrix',
            identifier:'species',
            placeholder: 'Select species...',
            getList: function(Project){
                return Project.getClasses().then(classes => {
                    // Exclude classes with repeating species names
                    var cl = {};
                    classes.forEach(cls => {
                        const id = cls.species_name.split(' ').join('_')
                        if (!cl[id]) {
                            cl[id] = {value:cls.species, caption:cls.species_name, name: id}
                        }
                    })
                    return Object.values(cl)
                })
            },
        },
    ];
})
.controller('recordingDataExportParametersController', function(
    $q,
    $injector,
    notify,
    recordingDataFieldTypes,
    a2UserPermit
){

    this.initialize = function(options){
        options = options || {};

        if(options.onExport){
            this.onExport = options.onExport;
        }

        this.parameter_set_list = recordingDataFieldTypes;
        this.selected = [];
        this.lists = this.parameter_set_list.map(function(){
            return [];
        });

        function getList(parameter_set){
            return $q.resolve(parameter_set.getList ?
                $injector.invoke(parameter_set.getList) :
                (parameter_set.list || [])
            );
        }


        $q.all(this.parameter_set_list.map(getList)).then((function(allLists){
            this.lists = allLists;
            if (this.isRfcx() && this.lists[1] && this.lists[1].length) {
                this.lists[1].splice(0,0,{value: -1, caption: 'Select all species'});
            }
            if (this.lists[5] && this.lists[5].length) {
                this.lists[5].splice(0,0,{value: 0, caption: 'Select all species', name: 0});
            }
            this.selected = this.parameter_set_list.map(function(parameter_set, idx){
                if(parameter_set.preselected){
                    var listByValue = allLists[idx].reduce(function(_, item){
                        _[item.value] = item;
                        return _;
                    }, {});

                    return (parameter_set.preselected || []).map(function(value){
                        return listByValue[value];
                    }).filter(function(_){
                        return !!_;
                    });
                } else {
                    return [];
                }
            });
        }).bind(this));
    };

    this.isSuper = a2UserPermit.isSuper();
    this.isRfcxUser = a2UserPermit.isRfcx();

    this.isRfcx = function () {
        return this.isRfcxUser || this.isSuper
    },

    this.checkSelectedValue = function(selected) {
        return selected && selected.find(function(row){ return row.value === -1 });
    }

    this.onSelected = function (selectedItem) {
        if (selectedItem && (selectedItem.value === -1) && (selectedItem.caption === 'Select all species')) {
            this.selected[1] = [selectedItem]
        }
        if (selectedItem && (selectedItem.value === 0) && (selectedItem.caption === 'Select all species')) {
            this.selected[5] = [selectedItem]
        }
    }

    this.resetFilters = function() {
        this.selected = [];
    };

    this.isDisabled = function() {
        return this.selected && this.selected[1] && this.selected[1].length && this.selected[1].length > 20
    };

    this.isRecordingEmpty = function() {
        return this.selected && this.selected[0] && this.selected[0].length === 0
    };

    this.exportData = function(){
        if (this.isRecordingEmpty()) {
            notify.log('At least 1 recording field is required');
            return;
        }
        var selected = this.selected;
        if (this.isRfcx() && selected[1] && selected[1].find(function(row){ return row.value === -1 })) {
            selected[1] = this.lists[1].filter(function(item) { if (item.value !== -1) { return item } });
        } 
        if (selected[5] && selected[5].find(function(row){ return row.value === 0 })) {
            selected[5] = this.lists[5].filter(function(item) { if (item.value !== 0) { return item } });
        }
        this.onExport(this.parameter_set_list.reduce(function(_, parameter_set, index){
            if (selected[index] && selected[index].length && parameter_set.identifier !== 'species') {
                _[parameter_set.identifier] = selected[index].map(function(item){
                    return item.value;
                });
            }
            if (selected[index] && parameter_set.identifier === 'grouped' && selected[index].value) {
                _[parameter_set.identifier] = selected[index].value;
                _['grouped'] = selected[index].value;
            }
            if (selected[index] && parameter_set.identifier === 'species' && selected[index].length) {
                _[parameter_set.identifier] = selected[index].map(function(item){
                    return item.value;
                });
                _['species_name'] = selected[index].map(function(item){
                    return item.name;
                });
            }
            return _;
        }, {}));
    };

    this.onExport = function(parameters){
        console.log("export parameters : ", parameters);
    };
})
;
