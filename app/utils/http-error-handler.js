const httpError = require('./http-errors')
const { ValidationError, ForbiddenError, EmptyResultError } = require('@rfcx/http-utils')

function httpErrorHandler (req, res, fallbackMessage) {
  return (err) => {
    if (err instanceof ValidationError) {
      return httpError(req, res, 400, null, err.message)
    }
    if (err instanceof ForbiddenError) {
      return httpError(req, res, 403, null, err.message)
    }
    if (err instanceof EmptyResultError) {
      return httpError(req, res, 404, null, err.message)
    }
    console.log(err)
    return httpError(req, res, 500, err, fallbackMessage)
  }
}

module.exports = { httpErrorHandler }
