/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var async = require('async');
var sinon = require('sinon');

var sha256 = require('../../utils/sha256');

describe('sha256()', function(){
    it('Should return the sha256 digest of any given string.', function(){
        sha256('').should.equal('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
        sha256('1').should.equal('6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b');
        sha256('papa fea').should.equal('b3ed360b2d567a87d0356362fd6d58caefbf083ef1326db81a18fae7516b95bc');
        sha256('qu qu qu 123 - ; \' "').should.equal('40f3ecf2420f86ae566ec96e6d14be2ec8cbab1dfda3f98d80b683355d697943');
        sha256('1`1').should.equal('37357b85d74708da6210614dbaa0be101d446149e9f217cc4f261f3dbcd87fdc');
        sha256('``21#33').should.equal('f9b969ea95a966f7a930d6c2e37b37c70c46348b6c64f7dc2832f2b4afb0ce51');
    });
    it('Should throw when given undefined arguments.', function(){
        should.throw(sha256);
    });
});
