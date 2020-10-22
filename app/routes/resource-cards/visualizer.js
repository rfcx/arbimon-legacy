var Recordings = require('../../model/recordings');

module.exports.rec = function (project, appUrl, url) {
    var urlarg;
    if(/^site\/.+$/.test(url)){
        urlarg = '!q:' + url.substr(5).replace(/\//g,'-');
    } else {
        urlarg = { id: url.split('?')[0] };
    }

    return Recordings.findByUrlMatch(urlarg, project.project_id,{
        compute: 'thumbnail-path'
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
