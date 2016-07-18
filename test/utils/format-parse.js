var chai = require('chai'), 
    expect = chai.expect, 
    should = chai.should();
    
var root = '../../app/';

var formatParse = require(root + 'utils/format-parse');

describe('format-parse', function(){
    describe('Wildlife format', function(){
        it('should parse datetime correctly.', function(){
            var result = formatParse('Wildlife','TEST_SM3_ 20140530_0630000.mp3');
            
            result.should.deep.equal({
                filename: 'TEST_SM3_ 20140530_0630000',
                datetime: new Date(2014, 4, 30, 6, 30),
                filetype: '.mp3'
            });
        });
    });
    
    describe('Arbimon format', function(){
        
        it('should parse datetime correctly.', function(){
            var result = formatParse('Arbimon','default-2014-08-25_17-30.flac');
            
            result.should.deep.equal({
                filename: 'default-2014-08-25_17-30',
                datetime: new Date(2014, 7, 25, 17, 30),
                filetype: '.flac' 
            });
        });
        
        it('should parse datetime correctly when format has seconds.', function(){
            formatParse('Arbimon','default-2014-08-25_17-30-45.flac').should.deep.equal({
                filename: 'default-2014-08-25_17-30-45',
                datetime: new Date(2014, 7, 25, 17, 30, 45),
                filetype: '.flac' 
            });
            formatParse('Arbimon','test-2015-03-16_15-44-55.flac').should.deep.equal({
                filename: 'test-2015-03-16_15-44-55',
                datetime: new Date(2015, 2, 16, 15, 44, 55),
                filetype: '.flac' 
            });            
        });
    
    });
    
    it('should throw error when format name is invalid', function() {
        var invalidFormat = 'formatName';
        
        (function() { 
            formatParse(invalidFormat, 'default-2014-08-25_17-30.flac');
        }).should.Throw(/invalid_format:/);
        
    });
    
    it('should throw error when filename time format invalid', function() {
        
        (function() { 
            formatParse('Arbimon', 'bird1.flac');
        }).should.Throw(/invalid_filename:/);
        
        (function() { 
            formatParse('Wildlife', 'bird1.flac');
        }).should.Throw(/invalid_filename:/);
        
    });
    
});
