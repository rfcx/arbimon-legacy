var express = require('express');
var router = express.Router();
var Playlists = require('../../../models/playlists');


router.param('playlist', function(req, res, next, playlist){
    Playlists.find({
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
    Playlists.find({project:req.project.project_id}, {count:true}, function(err, count) {
        if(err) return next(err);

        res.json(count);
        return null;
    });
});

// /** Return a list of all the playlist types in a project (actually in the system).
//  */
// router.get('/types', function(req, res, next) {
//     Playlists.getTypes(function(err, types) {
//         if(err) return next(err);
// 
//         res.json(types);
//         return null;
//     });
// });


// /** Add a playlist to a project.
//  */
// router.post('/add', function(req, res, next) {
//     Playlists.insert({
//         project : req.project.project_id,
//         name    : req.body.name,
//         type    : req.body.type,
//         extras  : req.body
//     }, function(err, new_tset) {
//         if(err) return next(err);
//         
//         model.projects.insertNews({
//             news_type_id: 7, // playlist created
//             user_id: req.session.user.id,
//             project_id: req.project.project_id,
//             data: JSON.stringify({ playlists: req.body.name })
//         });
//         
//         res.json(new_tset && new_tset[0]);
//         return null;
//     });
// });


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
