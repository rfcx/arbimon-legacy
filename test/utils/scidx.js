/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";
var dd=console.log;

var chai = require('chai'), should = chai.should(), expect = chai.expect;
var async = require('async');
var sinon = require('sinon');
var path = require('path');

var rewire = require('rewire');
var scidx = rewire('../../utils/scidx');

var real_file = scidx.__get__('file');
var mocks = {
    file: function(){
        if(mocks.file.__err__){
            arguments[arguments.length - 1](mocks.file.__err__);
        } else {
            real_file.apply(this, Array.prototype.slice.call(arguments));            
        }
    }
};
mocks.file.prototype = real_file.prototype;
scidx.__set__(mocks);

var datafile = path.resolve(__dirname, '../data/indexout.scidx');
var datafilev2 = path.resolve(__dirname, '../data/index-v2.scidx');
var brokendatafile = path.resolve(__dirname, '../data/indexincomplete.scidx');
var invaliddatafile = path.resolve(__dirname, '../data/paletteout.png');

var getBounds = function(index){
    var minx=1/0, maxx=-1/0, miny=1/0, maxy=-1/0;
    var rows=0, count=0;
    Object.keys(index).forEach(function(y){
        ++rows;
        if(miny < y){miny = y;}
        if(maxy > y){maxy = y;}
        var row = index[y];
        Object.keys(row).forEach(function(x){
            ++count;
            if(minx < x){minx = x;}
            if(maxx > x){maxx = x;}
        });
    });
    return {minx:minx,maxx:maxx,miny:miny,maxy:maxy, rows:rows, count:count};
};

describe('scidx', function(){
    describe('constructor', function(){
        it('Should construct an empty index object if given no values.', function(){
            var index = new scidx();
            index.index.should.deep.equal({});
            index.recordings.should.deep.equal([]);
            index.should.contain({
                'valid'      : false,
                'offsetx'    : 0, 'width'      : 0,
                'offsety'    : 0, 'height'     : 0
            });
        });
        it('Should construct valid scidx objects.', function(){
            var index = new scidx({1:{1:[2,3,4]}});
            index.index.should.deep.equal({1:{1:[2,3,4]}});
            index.recordings.should.deep.equal([]);
            index.should.contain({
                'valid'      : false,
                'offsetx'    : 0, 'width'      : 0,
                'offsety'    : 0, 'height'     : 0
            });
        });
    });
    describe('#read()', function(){
        afterEach(function(){
            delete mocks.file.__err__;
        });
        it('Should read valid scidx files.', function(done){
            new scidx().read(datafilev2, function(err, indexfile){
                should.not.exist(err);
                should.exist(indexfile);
                should.exist(indexfile.index);
                should.exist(indexfile.recordings);
                indexfile.valid.should.be.true;
                indexfile.should.contain.keys(['width', 'height', 'offsetx', 'offsety']);
                indexfile.version.should.equal(2);
                done();
            });
        });
        it('Should read valid scidx files (version 1).', function(done){
            new scidx().read(datafile, function(err, indexfile){
                should.not.exist(err);
                should.exist(indexfile);
                should.exist(indexfile.index);
                should.exist(indexfile.recordings);
                indexfile.valid.should.be.true;
                indexfile.should.contain.keys(['version', 'width', 'height', 'offsetx', 'offsety']);
                indexfile.version.should.equal(1);
                done();
            });
        });
        it('Should accept subregion filters.', function(done){
            new scidx().read(datafile, {
                'minx' : 10,
                'maxx' : 17,
                'miny' : 5,
                'maxy' : 20
            }, function(err, indexfile){
                should.not.exist(err);
                should.exist(indexfile);
                should.exist(indexfile.index);
                should.exist(indexfile.recordings);
                indexfile.valid.should.be.true;
                indexfile.should.contain.keys(['width', 'height', 'offsetx', 'offsety']);
                var bounds = getBounds(indexfile.index);
                bounds.minx.should.be.at.least(10);
                bounds.maxx.should.be.at.most(17);
                bounds.miny.should.be.at.least(5);
                bounds.maxy.should.be.at.most(20);
                done();
            });
        });
        it('Can be set to ignore offsets in the file.', function(done){
            new scidx().read(datafile, {ignore_offsets:true}, function(err, indexfile){
                should.not.exist(err);
                should.exist(indexfile);
                should.exist(indexfile.index);
                should.exist(indexfile.recordings);
                indexfile.valid.should.be.true;
                indexfile.should.contain.keys(['version', 'width', 'height', 'offsetx', 'offsety']);
                indexfile.version.should.equal(1);
                done();
            });
        });
        it('Can be set to just count the recordings in each cell.', function(done){
            new scidx().read(datafile, {just_count:true}, function(err, indexfile){
                should.not.exist(err);
                should.exist(indexfile);
                should.exist(indexfile.index);
                should.not.exist(indexfile.recordings);
                indexfile.valid.should.be.true;
                indexfile.should.contain.keys(['version', 'width', 'height', 'offsetx', 'offsety']);
                indexfile.version.should.equal(1);
                done();
            });
        });
        it('Fails if the file cannot be read.', function(done){
            mocks.file.__err__ = new Error('error!!!');
            new scidx().read(datafile, function(err, indexfile){
                should.exist(err);
                should.not.exist(indexfile);
                done();
            });
        });
        it('Fails if the file is not a scidx file.', function(done){
            new scidx().read(invaliddatafile, function(err, indexfile){
                should.exist(err);
                should.not.exist(indexfile);
                done();
            });
        });
        it('Fails if the file is corrupted.', function(done){
            this.timeout(500);
            new scidx().read(brokendatafile, function(err, indexfile){
                should.exist(err);
                should.not.exist(indexfile);
                done();
            });
        });
        it('Fails if the file is not closed properly.', function(done){
            var real_close = mocks.file.prototype.close;
            sinon.stub(mocks.file.prototype, 'close', function(){
                var cb = arguments[arguments.length-1];
                mocks.file.prototype.close.restore();
                real_close.call(this, function(){});
                cb(new Error("!!!"));
            });
            new scidx().read(datafile, function(err, indexfile){
                should.exist(err);
                should.not.exist(indexfile);
                done();
            });
        });
    });
    describe('#__read_rows()', function(){
        
    });
    describe('#__read_one_row()', function(){
        
    });
    describe('#__read_cells()', function(){
        
    });
    describe('#__read_one_cell()', function(){
        
    });
    describe('#flatten()', function(){
        it('Returns the set of recordings that participate in the index.', function(done){
            new scidx().read(datafile, function(err, indexfile){
                should.not.exist(err);
                should.exist(indexfile);
                should.exist(indexfile.index);
                should.exist(indexfile.recordings);
                indexfile.valid.should.be.true;
                indexfile.should.contain.keys(['version', 'width', 'height', 'offsetx', 'offsety']);
                indexfile.version.should.equal(1);
                
                indexfile.flatten().should.deep.equal([
                    476, 477, 478, 479, 480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, 494, 495, 496, 497,
                    498, 499, 500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514, 515, 516, 517, 518, 519, 520, 521, 522, 523, 524, 525, 526,
                    527, 528, 529, 530, 531, 532, 533, 534, 535, 536, 537, 538, 539, 540, 541, 542, 543, 544, 545, 546, 547, 548, 549, 550, 551, 552, 553, 554, 555,
                    556, 557, 558, 559, 560, 561, 562
                ]);
                done();
            });
        });
    });
    describe('#count()', function(){
        it('Returns the set of recordings that participate in the index.', function(done){
            new scidx().read(datafile, function(err, indexfile){
                should.not.exist(err);
                should.exist(indexfile);
                should.exist(indexfile.index);
                should.exist(indexfile.recordings);
                indexfile.valid.should.be.true;
                indexfile.should.contain.keys(['version', 'width', 'height', 'offsetx', 'offsety']);
                indexfile.version.should.equal(1);
                indexfile.count().should.equal(87);
                done();
            });
        });        
    });
    describe('#[pvt]str_repeat', function(){
        var __str_repeat = scidx.__get__('str_repeat');
        it('Should repeat a given string a given ammount of times', function(){
            __str_repeat('a', 1).should.equal('a');
            __str_repeat('a', 2).should.equal('aa');
            __str_repeat('ab', 2).should.equal('abab');
        });
        it('Should return empty string if given string is empty or times is 0', function(){
            __str_repeat('', 100).should.equal('');
            __str_repeat('abc', 0).should.equal('');
        });
    });
});
