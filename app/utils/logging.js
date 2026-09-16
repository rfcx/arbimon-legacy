const winston = require('winston')
const expressWinston = require('express-winston')
const { redactCredential } = require('./logging-redact')

/**
 * Build the request-log line.
 *
 * Exported so it can be unit-tested directly: express-winston does not expose
 * the `msg` function it is handed, so a test that goes through the logger
 * object cannot assert on the line this produces (OPEN-ITEMS §271).
 */
function buildLogMessage (req, res) {
  const body = req.body
  // NOTE this app authenticates BOTH ways, so this field carries either a
  // cookie-borne id_token (a bare JWT, no "Bearer " prefix) or the header
  // bearer token. Both are live credentials; redactCredential handles both.
  const authToken = req.cookies.id_token || req.headers.authorization
  let email
  if (req.session && req.session.user) {
    // cookie authentication
    email = req.session.user.email
  } else if (req.user) {
    // header authentication with Bearer token
    email = req.user.email
  }
  // OPEN-ITEMS §271: NEVER interpolate the raw credential -- it is a live user
  // credential (see ./logging-redact.js). The line SHAPE is unchanged so
  // existing support greps and Loki alert rules keep matching.
  return `${req.method} ${res.statusCode} ${req.url} Response Time: ${res.responseTime} Authorization: ${redactCredential(authToken)} Email: ${email} Body: ${JSON.stringify(body)}`
}

module.exports = expressWinston.logger({
  transports: [
    new winston.transports.Console()
  ],
  format: winston.format.combine(
    winston.format.simple()
  ),
  meta: false,
  msg: buildLogMessage,
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

module.exports.buildLogMessage = buildLogMessage