var crypto = require('crypto');
var shasum = crypto.createHash('sha256');

var sha256 = function (data) {
    shasum.update(data);
    return shasum.digest('hex');
}

module.exports = sha256;
