const axios = require('axios')

const SLACK_REPORT_ENABLED = process.env.SLACK_REPORT_ENABLED === 'true'
const SLACK_URL = process.env.SLACK_URL
const SLACK_TOKEN = process.env.SLACK_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL
const nodeEnv = process.env.NODE_ENV === 'production' ? 'production' : 'staging'

function combineStats (reportData) {
  let text = `\n:white_check_mark: *${reportData}* Arbimon recordings were deleted | ${nodeEnv || '---'}`
  return text
}

function combineErrorMessage (error) {
    let text = `\n:x: *${error}* Arbimon export recording error | ${nodeEnv || '---'}`
    return text
  }

async function reportStatsToSlack (text) {
  return await axios.post(SLACK_URL, {
    channel: SLACK_CHANNEL,
    username: `Arbimon Recording Delete Job ${process.env.NODE_ENV}`,
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
      username: `Arbimon Export Recording Job ${process.env.NODE_ENV}`,
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

async function reportStats (reportData) {
  const text = combineStats(reportData)
  console.info(text)
  if (SLACK_REPORT_ENABLED) {
    await reportStatsToSlack(text)
  }
}

async function errorMessage (error) {
    const text = combineErrorMessage(error)
    console.info(text)
    if (SLACK_REPORT_ENABLED) {
      await errorToSlack(text)
    }
  }

module.exports = {
  reportStats,
  errorMessage
}
