/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var async = require('async');
var sinon = require('sinon');
var rewire = require('rewire');

var tyler = rewire('../../../app/utils/tyler');
var mock_fs = require('../../mock_tools/mock_fs');

var mock_config = {
    spectrograms : { spectrograms: { tiles:{ max_width: 100, max_height:100}}}
};

var mocks = {
    fs : mock_fs,
    jimp: { read: function(filepath, callback){
        if(mocks.jimp.read.__err__){
            callback(mocks.jimp.read.__err__);
        } else {
            callback(null, mocks.jimp.read.__image__);
        }
    } },
    config : function (key){
        return mock_config[key];
    }
};
mocks.jimp.read.__image__ = {
    tile_cache:{},
    bitmap: { width: 200, height: 200 },
    set_tile: function(key, err){
        this.tile_cache[key] = {
            write: sinon.spy(function(filename, callback){
                if(err){
                    setImmediate(callback, err);
                } else {
                    setImmediate(callback);
                }
            })
        };
    },
    clone: function(){
        return this;
    },
    crop: function( x0, y0, w, h, callback){
        var x1 = x0 + w, y1 = y0 + h;
        var key = ''+x0+'_'+y0+'__'+x1+'_'+y1;
        if(this.tile_cache[key]){
            setImmediate(callback, null, this.tile_cache[key]);
        } else {
            setImmediate(callback, new Error('tile not in cache: ' + key));
        }
    }
};

tyler.__set__(mocks);


describe('tyler', function(){
    beforeEach(function(){
        delete mocks.jimp.read.__err__;
        mocks.jimp.read.__image__.tile_cache = {};
        sinon.spy(mocks.jimp.read.__image__, 'crop');
        mock_fs.__set_files__([]);
    });
    afterEach(function(){
        mocks.jimp.read.__image__.crop.restore();
    });
    it('Should not slice a tile if it already exists', function(done){
        mocks.jimp.read.__image__.set_tile('100_0__199_99');
        mocks.jimp.read.__image__.set_tile('100_100__199_199');
        mock_fs.__set_files__([
            {path: 'test.tile_0_1.png', atime:new Date()}
        ]);
        mocks.jimp.read.__image__.set_tile('0_0__99_99');
        tyler('test.png', function(err, results){
            mocks.jimp.read.__image__.crop.callCount.should.equal(3);
            should.not.exist(err);
            should.exist(results);
            results.should.deep.equal({
                height:200, width:200, x:2, y:2,
                set: [
                    {x:0, y:0, x0:0, y0:0, x1: 99, y1: 99},
                    {x:0, y:1, x0:0, y0:100, x1: 99, y1: 199},
                    {x:1, y:0, x0:100, y0:0, x1: 199, y1: 99},
                    {x:1, y:1, x0:100, y0:100, x1: 199, y1: 199}
                ]
            });
            done();
        });
    });
    it('Should slice an image in to tiles of a maximum size, given in the config settings', function(done){
        mocks.jimp.read.__image__.set_tile('100_0__199_99');
        mocks.jimp.read.__image__.set_tile('100_100__199_199');
        mocks.jimp.read.__image__.set_tile('0_100__99_199');
        mocks.jimp.read.__image__.set_tile('0_0__99_99');
        tyler('test.png', function(err, results){
            mocks.jimp.read.__image__.crop.callCount.should.equal(4);
            should.not.exist(err);
            should.exist(results);
            results.should.deep.equal({
                height:200, width:200, x:2, y:2,
                set: [
                    {x:0, y:0, x0:0, y0:0, x1: 99, y1: 99},
                    {x:0, y:1, x0:0, y0:100, x1: 99, y1: 199},
                    {x:1, y:0, x0:100, y0:0, x1: 199, y1: 99},
                    {x:1, y:1, x0:100, y0:100, x1: 199, y1: 199}
                ]
            });
            done();
        });
    });
    it('Should fail if a tile cannot be extracted.', function(done){
        mocks.jimp.read.__image__.set_tile('100_0__199_99');
        mocks.jimp.read.__image__.set_tile('100_100__199_199');
        // mocks.jimp.read.__image__.set_tile('0_100__99_199');
        mocks.jimp.read.__image__.set_tile('0_0__99_99');
        tyler('test.png', function(err, results){
            should.exist(err);
            should.not.exist(results);
            done();
        });
    });
    it('Should fail if an extracted tile cannot be written.', function(done){
        mocks.jimp.read.__image__.set_tile('100_0__199_99');
        mocks.jimp.read.__image__.set_tile('100_100__199_199');
        mocks.jimp.read.__image__.set_tile('0_100__99_199', new Error('I am error'));
        mocks.jimp.read.__image__.set_tile('0_0__99_99');
        tyler('test.png', function(err, results){
            should.exist(err);
            should.not.exist(results);
            done();
        });
    });
    it('Should return an error if jimp could not open the imaghe up.', function(done){
        mocks.jimp.read.__err__ = new Error("I am error");
        tyler('test.png', function(err, results){
            should.exist(err);
            should.not.exist(results);
            done();
        });
    });
    it('Should return an error if file is not a png file', function(done){
        tyler('not-a-png.txt', function(err){
            should.exist(err);
            done();
        });
    });
    it('Should return an error if filepath is missing or invalid', function(done){
        tyler(null, function(err){
            should.exist(err);
            tyler(3, function(err){
                should.exist(err);
                done();
            });
        });
    });
});
