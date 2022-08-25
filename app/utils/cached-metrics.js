var model = require('../model');
const moment = require('moment');

const getCountForSelectedMetric = async function(key, params) {
    let count
    switch (key) {
        case 'project-count':
            count = await model.projects.countAllProjects()
            break;
        case 'job-count':
            count = await model.jobs.countAllCompletedJobs()
            break;
        case 'species-count':
            count = await model.recordings.countAllSpecies()
            break;
        case 'recording-count':
            count = await model.recordings.countAllRecordings()
            break;
        case 'project-species-count':
            count = await model.recordings.countProjectSpecies(params)
            break;
        case 'project-recording-count':
            count = await model.projects.totalRecordings(params)
            break;
    }
    return count
}

const getRandomMin = function(max, min) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

const recalculateMetrics = async function(k, v, params, isInsert) {
    const value = await getCountForSelectedMetric(k, params)
    const expiresAt = moment.utc().add(1, 'days').add(getRandomMin(0, 60), 'minutes').format('YYYY-MM-DD HH:mm:ss')
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

module.exports = {
    getCachedMetrics: getCachedMetrics,
}
