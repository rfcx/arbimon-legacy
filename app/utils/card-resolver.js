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
                    // rfcx-local 2026-09-27: card functions may return NATIVE
                    // promises (resource-cards/visualizer.js goes through
                    // utils/project-scope.js, which is deliberately
                    // zero-dependency native-Promise). Returning that raw
                    // broke both callers
                    // (routes/project.js, routes/citizen-scientist.js), which
                    // use the Q-only `.nodeify` — a live UNHANDLED_ERROR_NET
                    // catch + pod restart on every cold visualizer-rec load.
                    // Q() assimilates either promise flavour, restoring the
                    // Q promise this contract advertises.
                    return Q(card(project, appUrl, comps.join('/')));
                } else {
                    // Own-properties only: inAppUrl components are
                    // user-controlled, and an inherited member (e.g.
                    // "constructor") is a Function too — the branch above
                    // would INVOKE it (CodeQL js/unsafe-dynamic-method-access).
                    var comp = comps.shift();
                    card = Object.prototype.hasOwnProperty.call(card, comp) ? card[comp] : undefined;
                }
            }
            
            deferred.resolve();
        }
        
        return promise;
    }
};


module.exports = CardResolver;
