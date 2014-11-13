var express = require('express');
var router = express.Router();
var model = require('../../../models');


router.param('soundscape', function(req, res, next, soundscape){
    model.soundscapes.find({
        name    : soundscape,
        project : req.project.project_id
    }, function(err, soundscapes) {
        if(err) return next(err);

        if(!soundscapes.length){
            return res.status(404).json({ error: "soundscape not found"});
        }
        req.soundscape = soundscapes[0];
        return next();
    });
});

/** Return a list of all the soundscapes in a project.
 */
router.get('/', function(req, res, next) {
    model.soundscapes.find({project:req.project.project_id}, {
        compute:req.query && req.query.show
    }, function(err, count) {
        if(err) return next(err);

        res.json(count);
        return null;
    });
});


module.exports = router;
