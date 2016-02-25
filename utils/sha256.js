var crypto = require('crypto');

var sha256 = function (data, encoding) {
    var shasum = crypto.createHash('sha256');
    shasum.update(data);
    return shasum.digest(encoding || 'hex');
};

module.exports = sha256;
