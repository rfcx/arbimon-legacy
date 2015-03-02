describe('a2utils module', function() {
    beforeEach(module('a2utils'));
    
    describe('paginate filter', function() {
        it('should return undefined when array not exits', inject(function($filter) {
            expect($filter('paginate')(0, 1, 10)).to.be.equal(undefined);
        }));
        
        it('should return same array as recieve if array.length is less than limitPerPage', inject(function($filter) {
            expect($filter('paginate')([1,2,3,4,5], 1, 10)).to.be.deep.equal([1,2,3,4,5]);
        }));
        
        it('should paginate array in 3 pages', inject(function($filter) {
            var input = [1,2,3,4,5,6,7,8,9,10];
            var page1 = [1,2,3,4];
            var page2 = [5,6,7,8];
            var page3 = [9,10];
            
            expect($filter('paginate')(input, 1, 4)).to.be.deep.equal(page1);
            expect($filter('paginate')(input, 2, 4)).to.be.deep.equal(page2);
            expect($filter('paginate')(input, 3, 4)).to.be.deep.equal(page3);
        }));
    });

});
