class LocalDB {
  constructor (opts = {}) {
    this.storage = {}
    setInterval(this.clear, opts.interval || 900000) // clear every 15 mins by default
  }
  get (id) {
    return this.storage[`${id}`]
  }
  set (id, value) {
    this.storage[`${id}`] = value
  }
  clear (id) {
    if (id) {
      delete this.storage[`${id}`]
    }
    else {
      this.storage = {}
    }
  }
}

module.exports = {
  LocalDB
}
