const parse = require("json-templates");
const k8s = require('../k8s')

/** Simple JSON value templating for Kubernetes Job Config.
 * @param {Object} options - Options defining the Kubernetes Job.
 * @param {String} opts.kubernetesJobName - The Kubernetes Job name.
 * @param {Integer} opts.minPoints - Epsilon clustering parameter.
 * @param {Integer} opts.distanceThreshold - Min. samples clustering parameter.
 * @param {String} opts.clusterJobId - Clustering job id parameter.
 * @param {String} opts.aedJobId - Audio Event Detection job id clustering parameter.
*/

function getTemplate (name, type, opts) {
    var json;
    try {
        json = k8s[type][name]
    } catch (e) {
        throw new Error(`${type} with name ${name} doesn't exist.`)
    }
    var template = parse(json);
    return template({
        "aed-clustering-timestamp": opts.kubernetesJobName,
        "imagePath": opts.imagePath,
        "ARG_EPSILON":  opts.minPoints,
        "ARG_MINSAMPLES": opts.distanceThreshold,
        "ARG_CLUSTER_JOBID": opts.clusterJobId,
        "ARG_AED_JOBID": opts.aedJobId
    });
}

module.exports = {
    getTemplate,
}
