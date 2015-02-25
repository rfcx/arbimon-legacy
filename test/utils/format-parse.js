var chai = require('chai'), 
    expect = chai.expect, 
    should = chai.should();
    
var root = '../../';

var formatParse = require(root + 'utils/format-parse');

describe('format-parse', function(){
    it('should return object when the filename complies Wildlife time format', function(){
        var result = formatParse('Wildlife','TEST_SM3_ 20140530_0630000.mp3');
        
        result.should.deep.equal({
            filename: 'TEST_SM3_ 20140530_0630000',
            year: '2014',
            month: '05',
            date: '30',
            hour: '06',
            min: '30',
            filetype: '.mp3' 
        });
    });
    
    it('should return object when the filename complies Arbimon time format', function(){
        var result = formatParse('Arbimon','default-2014-08-25_17-30.flac');
        
        result.should.deep.equal({
            filename: 'default-2014-08-25_17-30',
            year: '2014',
            month: '08',
            date: '25',
            hour: '17',
            min: '30',
            filetype: '.flac' 
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
    
    console.log();
});
