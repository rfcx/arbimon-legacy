describe('Module: a2utils', function() {
    beforeEach(module('a2utils'));
    
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
});
