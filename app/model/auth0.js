const config = require('../config');
const jsonwebtoken = require('jsonwebtoken');
const auth0Config = config('auth0');
const auth0BackendConfig = config('auth0_backend');
const request = require('request');
const { promisify } = require('util');
const rp = promisify(request);

const universalLoginUrl = `https://${auth0Config.auth0Domain}/authorize?audience=${auth0Config.audience}&scope=openid%20email%20profile%20offline_access` +
    `&response_type=code&client_id=${auth0Config.clientId}&redirect_uri=${auth0Config.redirectUri}&theme=dark`;

const logoutUrl = `https://${auth0Config.auth0Domain}/v2/logout?client_id=${auth0Config.clientId}&returnTo=${auth0Config.logoutRedirectUri}`;

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
  return jsonwebtoken.decode(tokens.id_token)
}

let tokenData;

async function getToken () {
  if (!tokenData || !isTokenValid()) {
    await createToken().catch(() => {});
  }
  if (!tokenData || !tokenData.token) {
    throw new Error('Cannot get authentication token')
  }
  return tokenData.token;
}

function isTokenValid() {
  // if token exists and won't expire in next 10 mins
  return tokenData && tokenData.expires_at - (new Date()).valueOf() > 600000;
}

async function createToken() {
  console.log('createToken', `https://${auth0BackendConfig.auth0Domain}/oauth/token`)
  const options = {
    method: 'POST',
    url: `https://${auth0BackendConfig.auth0Domain}/oauth/token`,
    headers: {
        'content-type': 'application/json'
    },
    body: JSON.stringify({
      client_id: auth0BackendConfig.clientId,
      client_secret: auth0BackendConfig.clientSecret,
      audience: auth0BackendConfig.audience,
      grant_type: 'client_credentials'
    })
  }
  const data = await rp(options)
  const body = JSON.parse(data.body)
  console.log('createToken body', body)
  if (body && body.access_token) {
    tokenData = {
      token: body.access_token,
      expires_at: new Date().valueOf() + (body.expires_in * 1000)
    }
  }
}

module.exports = {
  universalLoginUrl,
  logoutUrl,
  getTokensByCode,
  parseTokens,
  getToken,
}
