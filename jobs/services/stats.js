const axios = require('axios')

const SLACK_REPORT_ENABLED = process.env.SLACK_REPORT_ENABLED === 'true'
const SLACK_URL = process.env.SLACK_URL
const SLACK_TOKEN = process.env.SLACK_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL

function combineStats (reportData) {
  let text = `\n:white_check_mark: *${reportData}* Arbimon recordings were deleted`
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

async function reportStats (reportData) {
  const text = combineStats(reportData)
  console.info(text)
  if (SLACK_REPORT_ENABLED) {
    await reportStatsToSlack(text)
  }
}

module.exports = {
  reportStats
}
