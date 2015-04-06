describe('Module: audiodata.recordings', function() {
    beforeEach(function() { 
        module('audiodata.recordings');
        module('a2services');
        module('a2directives');
        module('ui.bootstrap');
        module('humane');
    });
    
    var $controller;

    beforeEach(inject(function(_$controller_){
        $controller = _$controller_;
    }));
    
    describe('Controller: RecsCtrl', function() {
        var controller,
            scope;
            
        beforeEach(inject(function($rootScope) {
            scope = $rootScope.$new();
            controller = $controller('RecsCtrl', { $scope: scope });
        }));
        
        describe('$scope.params', function() {
            it('is empty object', function() {
                expect(scope.params).to.deep.equal({});
            });
        });
    });
});
