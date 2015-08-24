/* jshint node:true */
"use strict";

var countries = require('./countries');

var isDomestic = function(countryCode) {
    var result = countries.filter(function(co) {
        return co.code == countryCode;
    });
    
    if(!result.length) return null;
    
    return !!result[0].domestic;
};


var getRate = function(totalOfRecorders, domestic) {
    var rates = {
        domestic: [10, 25],
        international: [25, 75],
    };
    
    var type = domestic ? 'domestic' : 'international';
    
    if(totalOfRecorders < 1) {
        return null;
    }
    else if(totalOfRecorders == 1) {
        return rates[type][0];
    }
    else {
        return Math.ceil(totalOfRecorders/10)*rates[type][1];
    }
};

var shippingCalculator = function(address, recorderQty) {
    var invalid = (
        !address.name ||
        !address.line1 ||
        !address.city ||
        !address.state ||
        !address.country_code ||
        !address.postal_code ||
        !address.telephone
    );
    
    if(invalid) {
        return { error: 'missing field' };
    }
    
    
    var domestic = isDomestic(address.country_code);
    
    if(domestic === null) {
        return {
            error: 'invalid country code'
        };
    }
    
    return {
        cost: getRate(recorderQty, domestic),
    };
};

module.exports = shippingCalculator;
