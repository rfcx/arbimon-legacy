class ForbiddenError extends Error {
  constructor (message) {
    super(message)
    this.message = message
    this.name = 'ForbiddenError'
  }
}
module.exports = ForbiddenError
