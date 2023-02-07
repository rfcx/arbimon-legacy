var debug = require('debug')('arbimon2:tyler');
var jimp = require('jimp');
var async = require('async');
var fs = require('fs');


var config = require('../config');



function tyler(filePath, callback1) {
    // console.time('duration');

    if(!filePath || typeof filePath !== "string") {
        return callback1(new Error('missing or invalid type filePath'));
    }

    var result = /(.+)\.png$/.exec(filePath);

    if(result === null) {
        return callback1(new Error('invalid file format for"'+ filePath +'"'));
    }

    filename = result[1];
    debug('creating tiles from "%s"', filename);


    jimp.read(filePath, function(err, image){
        if(err){
            callback1(new Error('Could not open image file ' + filePath));
            return;
        }
        var width = image.bitmap.width;
        var height = image.bitmap.height;

        var tileMaxWidth = config("spectrograms").spectrograms.tiles.max_width;
        var tileMaxHeight = config("spectrograms").spectrograms.tiles.max_height;

        var tileCountX = Math.ceil(width / tileMaxWidth); // calculate tile grid size
        var tileCountY = Math.ceil(height / tileMaxHeight);

        var x, y;
        var tiles = [];
        for(x=0; x < tileCountX; x++) {
            for(y=0; y < tileCountY; y++) {
                var tile = {
                    x: x,
                    y: y,
                    x0: Math.min(x * tileMaxWidth, width),
                    y0: Math.min(y * tileMaxHeight, height),
                    x1: Math.min((x+1) * tileMaxWidth, width)-1,
                    y1: Math.min( (y+1) * tileMaxHeight, height)-1,
                };

                tiles.push(tile);
            }
        }

        var result = {
            width: width,
            height: height,
            x : tileCountX,
            y : tileCountY,
            set: tiles
        };

        var tileFilenames = []

        debug('tiles coordinates:', tiles);

        async.each(tiles,
            function createTile(tileInfo, callback) {
                var tileFilename = filename + '.tile_'+ tileInfo.x + '_' + tileInfo.y + '.png';

                fs.exists(tileFilename, function(exists) {
                    if(exists) return callback();

                    try {
                        var tile = image.clone().crop(
                            tileInfo.x0, tileInfo.y0,
                            tileInfo.x1 - tileInfo.x0, tileInfo.y1 - tileInfo.y0
                        );
                        tileFilenames.push(tileFilename)
                        tile.write(tileFilename, function(err) {
                            if(err) return callback(err);

                            callback();
                        });

                    } catch(err){
                        callback(err);
                    }
                });
            },
            function finished(err) {
                if(err) return callback1(err);

                callback1(null, result, tileFilenames);
            }
        );
    });
}


// tyler('/home/chino/projects/arbimon2/tmpfilecache/2933c1e612f75a8e863c67bcdd3ba93b1fcf00010d78f803982c814af5898258.png', function(err, result) {
//     if(err) return console.log(err);
//
//     console.log(result);
// });

module.exports = tyler;
