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
        templateUrl:'/partials/audiodata/recording-data/export-parameters.html',
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
                {value:'time'      , caption:'Time'      , tooltip:'The recording time'      },
                {value:'recorder'  , caption:'Recorder'  , tooltip:'The recording recorder'  },
                {value:'microphone', caption:'Microphone', tooltip:'The recording microphone'},
                {value:'software'  , caption:'Software'  , tooltip:'The recording software'  },
            ],
            preselected:['filename', 'site', 'time']
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
        {   title:'Classifications',
            identifier:'classification',
            placeholder: 'Classifications...',
            getList: function(a2Classi){
                return a2Classi.list().then(function(classifications) {
                    return classifications.map(function(classification){
                        return {value:classification.job_id, caption:classification.cname};
                    });
                });
            },
        },
        {   title:'Soundscape Composition',
            identifier:'soundscapeComposition',
            placeholder: 'Wind, Birds, ...',
            getList: function(a2SoundscapeCompositionService){
                return a2SoundscapeCompositionService.getClassList().then(function(classes){
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

    this.exportData = function(){
        var selected = this.selected;
        this.onExport(this.parameter_set_list.reduce(function(_, parameter_set, index){
            if(selected[index] && selected[index].length){
                _[parameter_set.identifier] = selected[index].map(function(item){
                    return item.value;
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