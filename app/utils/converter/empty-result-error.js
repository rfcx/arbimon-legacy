class EmptyResultError extends Error {
  constructor (message) {
    super(message)
    this.message = message
    this.name = 'EmptyResultError'
  }
}
module.exports = EmptyResultError
