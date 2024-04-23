var model = require('../model');
const moment = require('moment');

const getCountForSelectedMetric = async function(key, projectId) {
    let count
    switch (key) {
        case 'project-count':
            count = await model.projects.countAllProjects()
            break;
        case 'job-count':
            count = await model.jobs.countAnalysesExecuted()
            break;
        case 'species-count':
            count = await model.species.countAllSpecies()
            break;
        case 'recording-count':
            count = await model.recordings.countAllRecordings()
            break;
        case 'project-species-count':
            count = await model.species.countProjectSpecies(projectId)
            break;
        case 'project-recording-count':
            count = await model.projects.totalRecordings(projectId)
            break;
        case 'project-site-count':
            count = await model.sites.countProjectSites(projectId)
            break;
        case 'project-playlist-count':
            count = await model.playlists.countProjectPlaylists(projectId)
            break;
        case 'project-pm-sp-count':
            count = await model.patternMatchings.totalPMSpeciesDetected(projectId)
            break;
        case 'project-pm-t-count':
            count = await model.patternMatchings.totalPMTemplates(projectId)
            break;
        case 'project-rfm-classif-job-count':
            count = await model.classifications.totalRfmClassificationJobs(projectId)
            break;
        case 'project-rfm-sp-count':
            count = await model.classifications.totalRfmSpeciesDetected(projectId)
            break;
        case 'project-rfm-training-job-count':
            count = await model.trainingSets.totalRfmTrainingJobs(projectId)
            break;
        case 'project-aed-job-count':
            count = await model.AudioEventDetectionsClustering.totalAedJobs(projectId)
            break;
        case 'project-clustering-job-count':
            count = await model.ClusteringJobs.totalClusteringJobs(projectId)
            break;
        case 'project-clustering-sp-count':
            count = await model.ClusteringJobs.totalClusteringSpeciesDetected(projectId)
            break;
        case 'project-soundscape-job-count':
            count = await model.soundscapes.totalSoundscapeJobs(projectId)
            break;
    }
    return count || 0
}

const getRandomMin = function(max, min) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

const recalculateMetrics = async function(k, v, params, isInsert) {
    const value = await getCountForSelectedMetric(k, params)
    const expiresAt = moment.utc().add(15, 'minutes').add(getRandomMin(0, 60), 'seconds').format('YYYY-MM-DD HH:mm:ss')
    isInsert ? await model.projects.insertCachedMetrics({ key: v, value, expiresAt }) : await model.projects.updateCachedMetrics({ key: v, value, expiresAt })
}

const getCachedMetrics = async function(req, res, key, params, next) {
    const k = Object.keys(key)[0]
    const v = Object.values(key)[0]
    model.projects.getCachedMetrics(v).then(async function(results) {
        if (!results.length) {
            await recalculateMetrics(k, v, params, insert=true)
            results = await model.projects.getCachedMetrics(v)
        }
        const [result] = results
        const count = result.value
        
        res.json(count)
        
        const dateNow = moment.utc().valueOf()
        const dateIndb = moment.utc(result.expires_at).valueOf()
        const isExpiresAtNotValid = !moment.utc(result.expires_at).isValid()
        // Recalculate metrics each day or if the expires_at data not valid, and save the results in the db
        if (isExpiresAtNotValid || (dateNow > dateIndb)) {
            await recalculateMetrics(k, v, params)
        }
    }).catch(next);
}

const getMetrics = async function(req, res, key, params, next) {
    getCountForSelectedMetric(key, params).then(async function(value) {
        res.json(value);
    }).catch(next);
}

module.exports = {
    getCachedMetrics: getCachedMetrics,
    getMetrics: getMetrics
}
