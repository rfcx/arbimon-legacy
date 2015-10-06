function APIError(message, status){
    Error.call(this, message);
    this.message = message;
    this.status = status;
}

APIError.prototype = (function(){
    function ptfixer(){}
    ptfixer.prototype = Error.prototype;
    return new ptfixer(); 
})(Error);

module.exports = APIError;