const crypto = require('crypto')

// OPEN-ITEMS §271: the request logger used to write the caller's COMPLETE
// credential -- the cookie `id_token` or the `Authorization: Bearer <JWT>`
// header -- into pod logs, which promtail ships to
// Loki (retention 336h). Measured 2026-09-15: 100% of sampled tokens were
// still valid when read, with 29-362 days of remaining life -- i.e. the logs
// held live, replayable user credentials for two weeks at a time.
//
// Three properties this module deliberately has:
//
//  1. A FIXED MARKER, NOT A TRUNCATION. A JWT prefix still contains the header
//     and (base64) payload, and the payload IS the identity -- so logging
//     "first 12 chars" would leak exactly what we are trying to protect.
//
//  2. A SHORT, NON-REVERSIBLE FINGERPRINT, so support can still correlate
//     several log lines as "the same caller" without the log holding a
//     credential. The salt defaults to a per-PROCESS random value: that keeps
//     fingerprints correlatable within one pod's logs (the support use case)
//     while making them useless as a cross-pod identifier or a dictionary
//     target. Set LOG_REDACTION_SALT to correlate across pods on purpose.
//
//  3. THE ABSENT/ANONYMOUS CASES PASS THROUGH UNCHANGED. `undefined` on this
//     field is real signal (measured: 173 such lines in a 20-minute sample =
//     anonymous
//     traffic), so it must stay distinguishable from a redacted credential.
const SALT = process.env.LOG_REDACTION_SALT || crypto.randomBytes(16).toString('hex')

function fingerprint (value) {
  return crypto.createHash('sha256').update(SALT).update(String(value)).digest('hex').slice(0, 8)
}

/**
 * Redact a credential-bearing header value for logging.
 *
 * Returns the value unchanged when there is no credential to protect, so that
 * "no Authorization header" stays visible in the logs as before.
 *
 * @param {*} value raw header/cookie value (may be undefined)
 * @returns {*} a safe-to-log replacement
 */
function redactCredential (value) {
  if (value === undefined || value === null || value === '') {
    return value
  }
  const raw = String(value)
  // Preserve the meaningful "no credential" markers verbatim -- they are signal,
  // not secrets, and downstream eyeballs/greps rely on them.
  if (raw === 'undefined' || raw === 'null' || raw === 'none') {
    return raw
  }
  const match = /^(Bearer|Basic|Token)\s+(.+)$/i.exec(raw)
  if (match) {
    return `${match[1]} [REDACTED:${fingerprint(match[2])}]`
  }
  // A bare credential with no scheme prefix -- e.g. the cookie-borne id_token
  // this app uses for browser sessions.
  return `[REDACTED:${fingerprint(raw)}]`
}

module.exports = { redactCredential }
