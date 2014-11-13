var express = require('express');
var router = express.Router();
var model = require('../../../models');


router.param('playlist', function(req, res, next, playlist){
    model.playlists.find({
        id      : playlist,
        project : req.project.project_id
    }, function(err, playlists) {
        if(err) return next(err);

        if(!playlists.length){
            return res.status(404).json({ error: "playlist not found"});
        }
        req.playlist = playlists[0];
        return next();
    });
});


/** Return a list of all the playlists in a project.
 */
router.get('/', function(req, res, next) {
    model.playlists.find({project:req.project.project_id}, {count:true}, function(err, count) {
        if(err) return next(err);

        res.json(count);
        return null;
    });
});

// /** Return a list of all the playlist types in a project (actually in the system).
//  */
// router.get('/types', function(req, res, next) {
//     model.playlists.getTypes(function(err, types) {
//         if(err) return next(err);
// 
//         res.json(types);
//         return null;
//     });
// });


/** Add a playlist to a project.
 */
router.post('/add', function(req, res, next) {
    
    if(!req.body.playlist_name || !req.body.params)
        res.json({ error: "missing parameters"})
        
    model.playlists.find({ 
        name: req.body.playlist_name,
        project: req.project.project_id
    },
    function(err, rows){
        if(err) return next(err);
        
        if(rows.length > 0)
            return res.json({ error: "playlist name in use" });
        
        model.playlists.create({
            project_id: req.project.project_id,
            name:    req.body.playlist_name,
            params:  req.body.params,
        },
        function(err, new_tset) {
            if(err) return next(err);
            
            console.log("playlist added", new_tset);
            
            model.projects.insertNews({
                news_type_id: 10, // playlist created
                user_id: req.session.user.id,
                project_id: req.project.project_id,
                data: JSON.stringify({ playlist: req.body.playlist_name })
            });
            
            res.json({ success: true });
        });
    });
});


// /** Add a data to a playlist.
//  */
// router.post('/add-data/:playlist', function(req, res, next) {
//     Playlists.addData(req.playlist, req.body, function(err, tset_data) {
//         if(err) return next(err);
//         return res.json(tset_data);
//     });
// });

/** Return a playlist's data.
 */
router.get('/list/:playlist', function(req, res, next) {
    Playlists.fetchData(req.playlist, req.query, function(err, data) {
        if(err) return next(err);

        res.json(data);
        return null;
    });
});



module.exports = router;
