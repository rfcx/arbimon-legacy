const winston = require('winston')
const expressWinston = require('express-winston')

module.exports = expressWinston.logger({
  transports: [
    new winston.transports.Console()
  ],
  format: winston.format.combine(
    winston.format.simple()
  ),
  meta: false,
  msg: (req, res) => {
    let body = req.body
    const authToken = req.cookies.id_token || req.headers.authorization
    let email
    if (req.session && req.session.user) {
      // cookie authentication
      email = req.session.user.email
    } else if (req.user) {
      // header authentication with Bearer token
      email = req.user.email
    }
    // const userEmail = (req.rfcx && req.rfcx.auth_token_info && req.rfcx.auth_token_info.email) ? req.rfcx.auth_token_info.email : 'none'
    return `${req.method} ${res.statusCode} ${req.url} Response Time: ${res.responseTime} Authorization: ${authToken} Email: ${email} Body: ${JSON.stringify(body)}`
  },
  expressFormat: false,
  statusLevels: true,
  ignoreRoute: (req, res) => {
    const deniedBeginnings = ['/jobs/progress', '/assets', '/images']
    for (const b of deniedBeginnings) {
      if (req.originalUrl.startsWith(b)) {
        return true
      }
    }
    return false
  }
})
