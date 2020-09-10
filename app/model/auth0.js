const config = require('../config');
const jwtDecode = require('jwt-decode')
const auth0Config = config('auth0')
const request = require('request')
const { promisify } = require('util')
const rp = promisify(request)

async function getTokensByCode(code) {
  const exchangeOptions = {
    grant_type: 'authorization_code',
    client_id: auth0Config.clientId,
    code,
    redirect_uri: auth0Config.redirectUri
}

  const options = {
      method: 'POST',
      url: `https://${auth0Config.auth0Domain}/oauth/token`,
      headers: {
          'content-type': 'application/json'
      },
      body: JSON.stringify(exchangeOptions)
  }
  try {
    const data = await rp(options)
    const body = JSON.parse(data.body)
    if (!body || !body.access_token || !body.id_token) {
      return null
    }
    return body
  } catch (e) {
    return null
  }
}

function parseTokens (tokens) {
  return jwtDecode(tokens.id_token)
}

module.exports = {
  getTokensByCode,
  parseTokens
}
