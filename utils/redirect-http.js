module.exports = function() {
    return function(req, res, next){
        if(req.protocol === 'http') {
            return res.redirect('https://' + req.hostname + securePort + req.originalUrl);
        }
        next();
    };
};
