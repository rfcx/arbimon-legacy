/*jshint node:true */
/*jshint mocha:true */
/*jshint expr:true */
"use strict";


var chai = require('chai'), should = chai.should(), expect = chai.expect;
var supertest = require('supertest');

var redirect_http = require('../../utils/redirect-http');


describe('redirect-http', function(){
    it('Should redirect a request to the same url, but using https.', function(done){
        supertest(redirect_http)
            .get('/this/is/test-url?what=1#q=1')
            .expect(301)
            .expect('location', /^https:\/\/[^\/]+\/this\/is\/test-url\?what=1$/)
            .end(done);        
    });
});
