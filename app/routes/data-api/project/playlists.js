var debug = require('debug')('arbimon2:route:playlists');
var express = require('express');
var router = express.Router();
var model = require('../../../model');

/** Return a list of all the playlists in a project.
 */
router.get('/', function(req, res, next) {
    res.type('json');
    model.playlists.find({project:req.project.project_id}, { 
        count:true, 
        show_type:true,
        show_info: !!req.query.info,
    }, function(err, count) {
        if(err) return next(err);

        res.json(count);
        return null;
    });
});

router.param('playlist', function(req, res, next, playlist){
    res.type('json');
    model.playlists.find({
        id      : playlist,
        project : req.project.project_id
    }, {
        count:true,
    },
    function(err, playlists) {
        if(err) return next(err);

        if(!playlists.length){
            return res.status(404).json({ error: "playlist not found"});
        }
        req.playlist = playlists[0];
        return next();
    });
});


/** Return a playlist's data.
 */
router.get('/:playlist', function(req, res, next) {
    res.type('json');
    model.playlists.fetchData(req.playlist, req.query, function(err, data) {
        if(err) return next(err);

        res.json(data);
        return null;
    });
});



/** Return a playlist's extra info.
*/
router.get('/info/:playlist', function(req, res, next) {
    res.type('json');
    model.playlists.getInfo(req.playlist, function(err, data) {
        if(err) return next(err);
        res.json(data);
    });
});

router.get('/:playlist/:recid/position', function(req, res, next) {
    res.type('json');
    model.playlists.fetchRecordingPosition(req.playlist, req.params.recid, function(err, data) {
        if(err) return next(err);
        res.json(data);
    });
});

router.get('/:playlist/:recid/next', function(req, res, next) {
    res.type('json');
    model.playlists.fetchNextRecording(req.playlist, req.params.recid, function(err, data) {
        if(err) return next(err);
        res.json(data);
    });
});

router.get('/:playlist/:recid/previous', function(req, res, next) {
    res.type('json');
    model.playlists.fetchPreviousRecording(req.playlist, req.params.recid, function(err, data) {
        if(err) return next(err);
        res.json(data);
    });
});


router.use(function(req, res, next) {
    if(!req.haveAccess(req.project.project_id, "manage playlists"))
        return res.json({ error: "you dont have permission to 'manage playlists'" });
    
    next();
});


/** Add a playlist to a project.
 */
router.post('/create', function(req, res, next) {
    res.type('json');
    
    if(!req.body.playlist_name || !req.body.params)
        return res.json({ error: "missing parameters"});
        
    model.playlists.find({
        name: req.body.playlist_name,
        project: req.project.project_id
    },
    function(err, rows){
        if(err) return next(err);
        
        if(rows.length > 0)
            return res.json({ error: "Playlist name in use" });
        model.playlists.create({
            project_id: req.project.project_id,
            name:    req.body.playlist_name,
            params:  req.body.params,
        }).then(function(new_tset) {
            debug("playlist added", new_tset);
            
            model.projects.insertNews({
                news_type_id: 10, // playlist created
                user_id: req.session.user.id,
                project_id: req.project.project_id,
                data: JSON.stringify({ playlist: req.body.playlist_name, playlist_id:new_tset.id })
            });
            
            res.json({ success: true });
        }).catch(next);
    });
});


/** Combine playlists into a new one.
 */
router.post('/combine', function(req, res, next) {
    res.type('json');
    if(!req.body.name){
        return res.json({ error: "missing name parameter"});
    }
    res.type('json');
    model.playlists.find({
        name: req.body.name,
        project: req.project.project_id
    }).then(function(rows){
        if(rows.length > 0){
            return res.json({ error: "Playlist name in use" });
        }
        return model.playlists.combine({
            name: req.body.name,
            project: req.project.project_id,
            operation: req.body.operation,
            term1: req.body.term1,
            term2: req.body.term2,
        });
    }).then(function(new_tset) {
            debug("playlists " + req.body.term1 + " and " + req.body.term2 + " combined (" + req.body.operation + ") into ", new_tset);
            
            model.projects.insertNews({
                news_type_id: 10, // playlist created
                user_id: req.session.user.id,
                project_id: req.project.project_id,
                data: JSON.stringify({ playlist: req.body.name, playlist_id:new_tset.id })
            });
            
            res.json({ success: true });
    }).catch(next);
});

// /** Add a data to a playlist.
//  */
// router.post('/add-data/:playlist', function(req, res, next) {
//     Playlists.addData(req.playlist, req.body, function(err, tset_data) {
//         if(err) return next(err);
//         return res.json(tset_data);
//     });
// });


router.post('/delete', function(req, res, next) {
    res.type('json');
    if(!req.body.playlists)
        return res.json({ error: "missing paramenters" });
    
    model.playlists.remove(req.body.playlists, function(err, results) {
        if(err) return next(err);
        
        debug('playlist deleted', results);
        res.json({ success: true });
    });
    
});




module.exports = router;
