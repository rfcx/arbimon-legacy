class ValidationError extends Error {
  constructor (message) {
    super(message)
    this.message = message
    this.name = 'ValidationError'
  }
}
module.exports = ValidationError
