var rewire=require('rewire');

var pre_wire = function pre_wire(import_module, mockups){
    var real_ones = {}, res, m;
    var global_ones = {};
    var globals = {fs:true};
    
    for(m in mockups){
        if(!globals[m]){
            res = require.resolve(m);
            require(m);
            real_ones[res] = rewire(m);
            require.cache[res].exports = mockups[m];
        }
    }
    for(m in mockups){
        if(globals[m]){
            global_ones[m] = global[m];
            global[m] = mockups[m];
        }
    }
    var mod = rewire(import_module);
    for(res in real_ones){
        require.cache[res].exports = real_ones[res];
    }
    for(m in global_ones){
        global[m] = global_ones[m];
    }
    return mod;
};


module.exports = pre_wire;
