/*jshint expr: true*/

describe('Module: a2.utils', function() {
    var $exceptionHandlerProvider;
    beforeEach(module('test-utils'));
    beforeEach(module('a2.utils'));
    beforeEach(module(["$exceptionHandlerProvider", function(_$exceptionHandlerProvider_) {
        $exceptionHandlerProvider = _$exceptionHandlerProvider_;
    }]));
    describe('Filters', function() {
        var $filter;
        
        beforeEach(function() {
            inject(function(_$filter_) { 
                $filter = _$filter_;
            });
        });
        
        describe('paginate', function() {
            var paginate;
            
            beforeEach(function() {
                paginate = $filter('paginate');
            });
            
            it('should return undefined when array not exits', function() { 
                expect(paginate(0, 1, 10)).to.be.equal(undefined);
            });
            
            it('should return same array as recieve if array.length is less than limitPerPage', function() {
                expect($filter('paginate')([1,2,3,4,5], 1, 10)).to.be.deep.equal([1,2,3,4,5]);
            });
            
            it('should paginate array with size=10 with limitPerPage=4 in 3 pages', function() {
                var input = [1,2,3,4,5,6,7,8,9,10];
                var page1 = [1,2,3,4];
                var page2 = [5,6,7,8];
                var page3 = [9,10];
                
                expect(paginate(input, 1, 4)).to.be.deep.equal(page1);
                expect(paginate(input, 2, 4)).to.be.deep.equal(page2);
                expect(paginate(input, 3, 4)).to.be.deep.equal(page3);
            });
        });
        
        describe('worded', function() { 
            var worded;
            
            beforeEach(function() {
                worded = $filter('worded');
            });
            
            it('should return string with "-" and "_" replace by spaces', function() { 
                var input1 = "Hello-this_is_a_string";
                var input2 = "Hello_this-is-a-string";
                var output = "Hello this is a string";
                
                expect(worded(input1)).to.be.equal(output);
                expect(worded(input2)).to.be.equal(output);
            });
        });
        
        describe('wordCaps', function() {
            var wordCaps;
            
            beforeEach(function() {
                wordCaps = $filter('wordCaps');
            });
            
            it('should return string with words capitalize', function() { 
                var input = "Hello this is a string";
                var output = "Hello This Is A String";
                
                expect(wordCaps(input)).to.be.equal(output);
            });
        });
    });
    
    describe('Factories', function(){
        describe('$debounce', function() {
            var $debounce;
            var $pumpRootScope;
            
            beforeEach(function() {
                inject(function(_$debounce_, _$pumpRootScope_) { 
                    $debounce = _$debounce_;
                    $pumpRootScope = _$pumpRootScope_;
                });
            });
            
            it('should return a function.', function() { 
                var debfn = $debounce(function(){});
                expect(debfn).to.be.instanceOf(Function);
            });
            describe('return value', function(){
                it('should return a promise.', function() { 
                    inject(function($q){
                        var retval = $debounce(function(){})();
                        expect(retval).to.exist;
                        expect(retval.then).to.be.instanceOf(Function);
                    });
                });
                it('should return the same promise for each debounced call.', function() { 
                    inject(function($q){
                        var debFn = $debounce(function(){});
                        var p1 = debFn();
                        var p2 = debFn();
                        $pumpRootScope();
                        expect(p1).to.equal(p2);
                    });
                });
                it('should return different promises for non debounced calls.', function() { 
                    inject(function($q){
                        var debFn = $debounce(function(){});
                        var p1 = debFn();
                        $pumpRootScope();
                        var p2 = debFn();
                        expect(p1).to.not.equal(p2);
                    });
                });
                it('promise should resolve to function return value.', function(done) { 
                    inject(function($q){
                        var obj = {a:1};
                        $debounce(function(){
                            return obj;
                        })().then(function(retval){
                            expect(retval).to.equal(obj);
                            done();
                        });
                        $pumpRootScope();
                    });
                });
            });
            it('should pass through the arguments and context to the given function.', function(done) { 
                inject(function(){
                    var object = {};
                    $debounce(function(){
                        var args = Array.prototype.slice.call(arguments);
                        expect(this).to.equal(object);
                        expect(args).to.deep.equal([1, 2, 3]);
                        done();
                    }).call(object, 1, 2, 3);
                    $pumpRootScope();
                });
            });
            it('should filter out sequential calls.', function() { 
                inject(function(){
                    var callCount=0;
                    var debFn = $debounce(function(){
                        callCount++;
                    });
                    debFn();
                    debFn();
                    debFn();
                    debFn();
                    $pumpRootScope();
                    expect(callCount).to.equal(1);
                });
            });
            it('should filter out calls within a given time interval.', function() { 
                inject(function(){
                    var callCount=0;
                    var debFn = $debounce(function(){
                        callCount++;
                    }, 100);
                    debFn();
                    debFn();
                    debFn();
                    $pumpRootScope(10);
                    debFn();
                    $pumpRootScope();
                    expect(callCount).to.equal(1);
                });
            });
            it('should not filter out calls outside of the given time interval.', function() { 
                inject(function(){
                    var callCount=0;
                    var debFn = $debounce(function(){
                        callCount++;
                    }, 100);
                    debFn();
                    $pumpRootScope(100);
                    debFn();
                    $pumpRootScope();
                    expect(callCount).to.equal(2);
                });
            });
        });        
    });
});
