const parse = require("json-templates");
const k8s = require('../k8s')

/** Simple JSON value templating for Kubernetes AED Job Config.
 * @param {Object} options - Options defining the Kubernetes Job.
 * @param {String} opts.kubernetesJobName - The Kubernetes Job name.
 * @param {Integer} opts.distanceThreshold - Epsilon clustering parameter.
 * @param {Integer} opts.minPoints - Min. samples clustering parameter.
 * @param {String} opts.maxClusterSize - The maximum number of points to retain in each cluster.
 * @param {String} opts.clusterJobId - Clustering job id parameter.
 * @param {String} opts.aedJobId - Audio Event Detection job id clustering parameter.
*/

function getAEDJobTemplate (name, type, opts) {
    let json;
    try {
        json = k8s[type][name]
    } catch (e) {
        throw new Error(`${type} with name ${name} doesn't exist.`)
    }
    const template = parse(json);
    return template({
        "aed-clustering-timestamp": opts.kubernetesJobName,
        "imagePath": opts.imagePath,
        "ARG_EPSILON":  opts.distanceThreshold,
        "ARG_MINSAMPLES": opts.minPoints,
        "ARG_MAXCLUSTERSIZE": opts.maxClusterSize,
        "ARG_CLUSTER_JOBID": opts.clusterJobId,
        "ARG_AED_JOBID": opts.aedJobId
    });
}

/** Simple JSON value templating for Kubernetes Soundscape Job Config.
 * @param {Object} options - Options defining the Kubernetes Job.
 * @param {String} opts.kubernetesJobName - The Kubernetes Job name.
 * @param {String} opts.ENV_PROJECT - Project identifier (core or arbimon) or url slug (e.g. puerto-rico-island-wide).
 * @param {String} opts.ENV_SITES - Comma-separated list of site names including wildcards (e.g. AB2,AB3,CD*) - empty for all sites.
 * @param {String} opts.ENV_YEAR - Single year (e.g. 2022) - empty for all years.
 * @param {String} opts.ENV_SOUNDSCAPE_AGGREGATION - Time aggregration.
 * @param {Integer} opts.ENV_SOUNDSCAPE_BIN_SIZE - Bin size/bandwidth (Hz).
 * @param {Integer} opts.ENV_SOUNDSCAPE_NORMALIZE - Normalize results.
 * @param {Integer} opts.ENV_SOUNDSCAPE_THRESHOLD - Peak filtering amplitude threshold.
*/

function getSoundscapeBatchRunTemplate (name, type, opts) {
    let json;
    try {
        json = k8s[type][name]
    } catch (e) {
        throw new Error(`${type} with name ${name} doesn't exist.`)
    }
    const template = parse(json);
    return template({
        "arbimon-soundscape-timestamp": opts.kubernetesJobName,
        "imagePath": opts.imagePath,
        "ENV_JOB_ID": opts.ENV_JOB_ID
    });
}

function getRfmTemplate (name, type, opts) {
    let json;
    try {
        json = k8s[type][name]
    } catch (e) {
        throw new Error(`${type} with name ${name} doesn't exist.`)
    }
    const template = parse(json);
    return template({
        "arbimon-rfm-train-job-timestamp": opts.kubernetesJobName,
        "imagePath": opts.imagePath,
        "ENV_JOB_ID": opts.ENV_JOB_ID
    });
}

function getRfmRetrainTemplate (name, type, opts) {
    let json;
    try {
        json = k8s[type][name]
    } catch (e) {
        throw new Error(`${type} with name ${name} doesn't exist.`)
    }
    const template = parse(json);
    return template({
        "arbimon-rfm-retrain-job-timestamp": opts.kubernetesJobName,
        "imagePath": opts.imagePath,
        "ENV_JOB_ID": opts.ENV_JOB_ID
    });
}

function getClassificationJobTemplate (name, type, opts) {
    let json;
    try {
        json = k8s[type][name]
    } catch (e) {
        throw new Error(`${type} with name ${name} doesn't exist.`)
    }
    const template = parse(json);
    return template({
        "arbimon-rfm-classify-job-timestamp": opts.kubernetesJobName,
        "imagePath": opts.imagePath,
        "ENV_JOB_ID": opts.ENV_JOB_ID
    });
}

module.exports = {
    getAEDJobTemplate,
    getSoundscapeBatchRunTemplate,
    getRfmTemplate,
    getRfmRetrainTemplate,
    getClassificationJobTemplate
}
