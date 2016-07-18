var Q = require('q');

var CardResolver = function(cardStack){
    if(!(this instanceof CardResolver)){
        return new CardResolver(cardStack);
    }
    this.cardStack = cardStack;
};

CardResolver.prototype = {
    /**
     * Returns a card naming and describing the resource pointed to by the inAppUrl.
     * @param {Object} project The associated project.
     * @param {Object} appUrl The base url where the app is located.
     * @param {Object} inAppUrl The url used to fetch the resource within the app.
     * @param {Object} cardStack object holding the cards. Each key is a 
     *                 component in the path, and each value is either a function
     *                 returning a Promise of a card, or an object with this samples
     *                 structure.
     * @return {Object} Promise returning object describing the resource pointed to by the inAppUrl.
     */
    getCardFor: function(project, appUrl, inAppUrl){
        var deferred = Q.defer();
        var promise = deferred.promise;
        
        if(!project || !inAppUrl){
            deferred.reject(new Error("Project or inAppUrl not given."));
        } else {
            var comps = inAppUrl.split('/');
            var card = this.cardStack;
            while(comps.length > 0 && card){
                if(card instanceof Function){
                    return card(project, appUrl, comps.join('/'));
                } else {
                    card = card[comps.shift()];            
                }
            }
            
            deferred.resolve();
        }
        
        return promise;
    }
};


module.exports = CardResolver;
