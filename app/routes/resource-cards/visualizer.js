var Recordings = require('../../model/recordings');
var projectScope = require('../../utils/project-scope');

module.exports.rec = function (project, appUrl, url) {
    var urlarg;
    if(/^site\/.+$/.test(url)){
        urlarg = '!q:' + url.substr(5).replace(/\//g,'-');
    } else {
        urlarg = { id: url.split('?')[0] };
    }

    // rfcx-local OPEN-ITEMS §391: the share card (name + thumbnail) must not
    // describe another project's recording; a foreign one gets no card, exactly
    // like an unknown one.
    return projectScope.recordingUrlOwned(Recordings, urlarg, project.project_id).then(function(owned){
        if(!owned){
            return [];
        }
        return Recordings.findByUrlMatch(urlarg, project.project_id,{
            compute: 'thumbnail-path'
        });
    }).then(function(recordings){
        var recording = recordings && recordings.shift();
        if(!recording){
            return;
        }

        return {
            name: recording.site + " " + recording.datetime,
            url : appUrl + 'visualizer/rec/' + recording.id,
            image : {
                fb : recording.thumbnail
            },
            description : '',
            date : recording.datetime
        };
    });
};
