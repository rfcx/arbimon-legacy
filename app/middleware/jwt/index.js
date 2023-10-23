const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');

const cert = fs.readFileSync(path.join(process.cwd(), 'app/middleware/jwt/rfcx.pub'));

function obtainRoles(user) {
  if (user.roles) { return user.roles; }
  let rfcxAppMetaUrl = 'https://rfcx.org/app_metadata';
  if (user[rfcxAppMetaUrl] && user[rfcxAppMetaUrl].authorization && user[rfcxAppMetaUrl].authorization.roles) {
    return user[rfcxAppMetaUrl].authorization.roles
  }
  if (user.scope) {
    if (typeof user.scope === 'string') {
      try {
        let parsedScrope = JSON.parse(user.scope);
        if (parsedScrope.roles) { return parsedScrope.roles; }
      }
      catch (e) { }
    }
    else {
      if (user.scope.roles) { return user.scope.roles; }
    }
  }
  return [];
}

const verifyToken = function() {
  return function(req, res, next) {
    let token = req.headers['authorization'];
    if (!token) {
      return res.sendStatus(401);
    }
    if (token.startsWith('Bearer ')) { // Remove Bearer from string
      token = token.slice(7, token.length);
    }
    let decodedToken
    try {
      decodedToken = jwt.verify(token, cert);
    }
    catch (e) {
      return res.sendStatus(401)
    }
    if (!decodedToken) {
      res.sendStatus(401)
    }
    else {
      req.user = decodedToken;
      next();
    }
  }
}

const parseTokenData = function() {
    return function(req, res, next) {
      const headersToken = req.headers['authorization']
      const sessionToken = req.session && req.session.idToken ? req.session.idToken : null
      console.log('\n\n - token', headersToken, sessionToken)
      let token = headersToken ? headersToken : sessionToken
      if (!token) {
        req.user = null
      }
      else if (token) {
        if (token.startsWith('Bearer ')) {
          token = token.slice(7, token.length);
        }
        let decodedToken
        try {
          decodedToken = jwt.verify(token, cert);
          req.user = decodedToken;
        }
        catch (e) {
          req.user = null
        }
      }
      next();
    }
}

const hasRole = function(expectedRoles) {
  expectedRoles = (Array.isArray(expectedRoles)? expectedRoles : [expectedRoles]);
  return function(req, res, next) {
    if (expectedRoles.length === 0) { return next(); }
    if (!req.user) { return res.sendStatus(403); }
    let roles = obtainRoles(req.user);
    var allowed = expectedRoles.some((role) => {
      return roles.indexOf(role) !== -1;
    });
    return allowed ? next() : res.sendStatus(403);
  }
}

module.exports = {
  verifyToken,
  hasRole,
  parseTokenData
}
