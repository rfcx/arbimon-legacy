var chai = require('chai'), should = chai.should(), expect = chai.expect;
var sinon = require('sinon');
var lodash = require('lodash');

// methods from express API
var responseMethods = [
    "redirect",
    "render",
    "next",
    "send",
    "status",
    "sendStatus",
    "json"
];

var MockResponse = function(expectations, done) {
    this.expectations = expectations;
    this.done = done;
    var self = this;
    
    responseMethods.forEach(function(fn){
        
        self[fn] = sinon.spy(function() {
            
            if(fn === "status")
                return this;
            else {
                this.verify();
            }
            
        });
    });
};

MockResponse.prototype.verify = function() {
    var self = this;
    
    responseMethods.forEach(function(fn){
        var emsg;
        
        if(self.expectations[fn]) {
            if(self[fn].callCount !== 1)  {
                emsg = "Expected 1 call to res." + fn + " instead got " + 
                       self[fn].callCount + "calls";
                throw new Error();
            }
            expect(self[fn].firstCall.args).to.deep.equal(self.expectations[fn]);
        }
        else {
            if(self[fn].callCount > 0)  {
                emsg = "Expected 0 call to res." + fn + " instead got " + 
                       self[fn].callCount + "calls";
                throw new Error();
            }
        }
    });
    
    this.done();
};


/**
 * @class mock_tools/router_expect
 * @description expressjs router expectation lib
 * @param router {Object} expressjs router
 * @param defaults {Object} default request
 */
var router_expect = function(router, defaults){
    if(!(this instanceof router_expect)){
        return new router_expect(router, defaults);
    }
    this.router = router;
    this.defaults = lodash.merge({
        _params:[],
        query:{},
        params:{},
        param: function(p){
            var v = this._params[p];
            return v;
        },
        method: 'GET'
    }, defaults || {});
};

router_expect.prototype = {
    /**
     * @method mock_tools/router_expect#when
     * @param url {Object} request object
     * @param expectations {Object} response expectations
     * @param [scope] {Object} object which request and reponse object are assigned to
     */
    whenExpect: function(url, expectations, done){
        var request = lodash.cloneDeep(this.defaults);
        if(typeof url == 'string'){
            request.url = url;
        } 
        else {
            lodash.merge(request, url);
        }
        var response = new MockResponse(expectations, done);
        this.router.handle(request, response, response.next.bind(response));
    }
};

module.exports = router_expect;
