var sinon = require('sinon');
var lodash = require('lodash');
var dd = console.log;

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
        _params:{},
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
     * @param scope (optional) {Object} object which request and reponse object are assigned to
     */
    when: function(url, expectations, scope){
        var request = lodash.cloneDeep(this.defaults);
        if(typeof url == 'string'){
            request.url = url;
        } else {
            lodash.merge(request, url);
        }
        var response = new expected_response(request, expectations);
        
        if(scope){
            scope.req = request;
            scope.res = response;
        }
        
        this.router.handle(request, response, response.next.bind(response));
        
        
    }
};

var slice = Array.prototype.slice;
var make_expect_fn = function(name){
    return function(){
        var args = slice.call(arguments);
        var exp = this.expect && this.expect[name];
        if(exp){
            if(exp instanceof Function){
                args.unshift(this.request, this);
                exp.apply(null, args);
            }
        } else {
            throw args.length > 0 && args[0] instanceof Error ? args[0] : new Error("Unexpected call to res."+name+"("+args.map(JSON.stringify).join(", ")+")");
        }
        return this;
    };
};

var expected_response = function(request, expectations){
    this.request = request;
    this.expect = expectations;
    for(var i in expect_functions){
        this[i] = sinon.spy(expect_functions[i]);
    }
};

var expect_functions = {};
["redirect","render","next","send","status","sendStatus","json", "type","write"].forEach(function(fn){
    expect_functions[fn] = make_expect_fn(fn);
});

module.exports = router_expect;
