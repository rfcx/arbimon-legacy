(function(){

var a2TagsModule = angular.module('a2.directive.a2-tags', [
    'templates-arbimon2'
])

var a2TagTypes = [
    'classi',
    'classes',
    'model',
    'playlist',
    {tag:'project', linkTo: function(tagId){
        return "/project/?id=" + tagId;
    }},
    'site',
    'species',
    'song',
    'soundscape',
    'training_set',    
];

a2TagTypes.forEach(function(tagType){
    if('string' == typeof tagType){
        tagType = {tag:tagType};
    }
    
    tagType.tcTag = tagType.tag.replace(/(^|\b|-)(\w)/, function(_0, _1, _2){ return _2.toUpperCase(); });
    
    a2TagsModule.directive('a2Tag'+tagType.tcTag, function($injector){
        return {
            restrict: 'EAC',
            scope:{
                tag: '=a2Tag'+tagType.tcTag
            },
            link: function(scope, element, attrs){
                var tagName, tagId, tagLink;
                var aElement = element.find('a');
                element.addClass('a2-tag a2-tag-'+tagType.tag);
                
                scope.$watch('tag', function(tag){
                    if(tag instanceof Array){
                        tagId = tag[0];
                        tagName = tag[1];
                        if(tagId && tagType.linkTo){
                            tagLink = $injector.invoke(tagType.linkTo, null, {
                                tagId: tagId
                            });
                        }
                    } else {
                        tagId = null;
                        tagName = tag;
                    }
                    var tagElement = angular.element(tagLink ? '<a></a>' : '<span></span>').appendTo(element.empty());
                    tagElement.text(tagName);
                    if(tagLink){
                        tagElement.attr('href', tagLink);
                    }
                });
            }
        };
    })
    ;
});


})();
