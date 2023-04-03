const axios = require('axios')

const SLACK_REPORT_ENABLED = process.env.SLACK_REPORT_ENABLED === 'true'
const SLACK_URL = process.env.SLACK_URL
const SLACK_TOKEN = process.env.SLACK_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL
const nodeEnv = process.env.NODE_ENV === 'production' ? 'production' : 'staging'

function combineStats (reportData, jobName) {
  let text = `\n:white_check_mark: *${reportData}* Arbimon ${jobName} finished | ${nodeEnv || '---'}`
  return text
}

function combineErrorMessage (error, jobName) {
  let text = `\n:x: *${error}* Arbimon ${jobName} error | ${nodeEnv || '---'}`
  return text
}

async function reportStatsToSlack (text, jobName) {
  return await axios.post(SLACK_URL, {
    channel: SLACK_CHANNEL,
    username: `Arbimon ${jobName} ${process.env.NODE_ENV}`,
    icon_emoji: ':rocket:',
    mrkdwn: true,
    text
  }, {
    headers: {
      authorization: `Bearer ${SLACK_TOKEN}`,
      'Content-Type': 'application/json'
    }
  })
}

async function errorToSlack (text) {
  return await axios.post(SLACK_URL, {
    channel: SLACK_CHANNEL,
    username: `Arbimon ${jobName} ${process.env.NODE_ENV}`,
    icon_emoji: ':fire:',
    mrkdwn: true,
    text
  }, {
    headers: {
      authorization: `Bearer ${SLACK_TOKEN}`,
      'Content-Type': 'application/json'
    }
  })
}

async function reportStats (reportData, jobName) {
  const text = combineStats(reportData, jobName)
  console.info(text)
  if (SLACK_REPORT_ENABLED) {
    await reportStatsToSlack(text, jobName)
  }
}

async function errorMessage (error, jobName) {
    const text = combineErrorMessage(error, jobName)
    console.info(text)
    if (SLACK_REPORT_ENABLED) {
      await errorToSlack(text, jobName)
    }
  }

module.exports = {
  reportStats,
  errorMessage
}
