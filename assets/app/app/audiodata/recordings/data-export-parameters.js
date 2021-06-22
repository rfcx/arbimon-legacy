angular.module('a2.audiodata.recordings.data-export-parameters', [
    'a2.directive.a2-auto-close-on-outside-click',
    'a2.services',
    'a2.directives',
    'ui.bootstrap',
    'humane',
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
        {   title:'Recording Data',
            identifier:'recording',
            placeholder: 'filename, site, ...',
            list:[
                {value:'filename'  , caption:'Filename'  , tooltip:'The recording filename'  },
                {value:'site'      , caption:'Site'      , tooltip:'The recording site'      },
                {value:'day'       , caption:'Day'       , tooltip:'The recording day'       },
                {value:'hour'      , caption:'Hour'      , tooltip:'The recording hour'      }
            ],
            preselected:['filename', 'site', 'day']
        },
        {   title:'Validations',
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
        {   title:'Occupancy models format',
            identifier:'species',
            placeholder: 'Species...',
            getList: function(Project){
                return Project.getClasses().then(function(classes){
                    return classes.map(function(cls){
                        return {value:cls.species, caption:cls.species_name, name: cls.species_name.split(' ').join('_')};
                    });
                });
            },
        },
    ];
})
.controller('recordingDataExportParametersController', function(
    $q,
    $injector,
    $scope,
    recordingDataFieldTypes
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
            if (this.lists[1]) {
                this.lists[1].splice(0,0,{value: -1, caption: 'Select all species'});
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

    this.checkSelectedValue = function(selected) {
        return selected && selected.find(function(row){ return row.value === -1 });
    }

    this.onSelected = function (selectedItem) {
        if (selectedItem && selectedItem.value === -1 ) {
            this.selected[1] = [selectedItem]
        }
    }

    this.resetFilters = function() {
        this.selected = [];
    };

    this.exportData = function(){
        var selected = this.selected;
        if (selected[1] && selected[1] && selected[1].find(function(row){ return row.value === -1 })) {
            selected[1] = this.lists[1].filter(function(item) { if (item.value !== -1) { return item } });
        }
        this.onExport(this.parameter_set_list.reduce(function(_, parameter_set, index){
            if(selected[index] && selected[index].length){
                _[parameter_set.identifier] = selected[index].map(function(item){
                    return item.value;
                });
            }
            if(selected[index] && parameter_set.identifier==='species' && selected[index].value){
                _[parameter_set.identifier] = selected[index].value;
                _['species_name'] = selected[index].name;
            }
            return _;
        }, {}));
    };

    this.onExport = function(parameters){
        console.log("export parameters : ", parameters);
    };
})
;
