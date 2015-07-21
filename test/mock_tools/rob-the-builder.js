/*jshint node:true */
"use strict";

/**
 * creates a mock contructor with a optional prototype
 * @returns {Object} Constructor function - this contructor will have a 
 *          Constructor.instances array that will contain an object per instance 
 *          created { obj: 'object instance', args: 'arguments given'}
 */ 
var robTheBuilder = function(proto) {
    var constructorMock = function(){
        constructorMock.instances.push({
            obj: this,
            args: arguments
        });
    };
    
    constructorMock.instances = [];
    
    if(proto) {
        constructorMock.prototype = proto;
    }
    
    return constructorMock;
};

module.exports = robTheBuilder;
