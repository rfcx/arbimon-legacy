var crypto = require('crypto');

var sha256 = function (data) {
    var shasum = crypto.createHash('sha256');
    shasum.update(data);
    return shasum.digest('hex');
};

module.exports = sha256;
