var timeUtils = require('../misc/time')
const moment = require('moment-timezone')

module.exports = class Conversion {
  constructor (src, property, target = null) {
    this.src = src

    if (target == null) {
      target = src
    }
    this.target = target
    this.property = property

    this.value = null
    this.conversions = []
    this.required = true
    this.defaultValue = null
  }

  execute () {
    if (this.required && this.src[this.property] == null) {
      this.throwError('the parameter is required but was not provided')
    }

    this.value = this.src[this.property] !== undefined ? this.src[this.property] : this.defaultValue

    if (!this.required && this.value === null) {
      return this.value
    }

    for (var executeValidation of this.conversions) {
      executeValidation()
    }

    this.target[this.property] = this.value
  }

  default (def) {
    this.optional()
    if (def !== undefined) {
      this.defaultValue = def
    }
    return this
  }

  optional () {
    this.required = false
    return this
  }

  throwError (message) {
    throw new Error(`Parameter '${this.property}' ${message}`)
  }

  toFloat () {
    this.conversions.push(() => {
      const newValue = parseFloat(this.value)
      if (isNaN(newValue)) {
        this.throwError('should be a float')
      }
      this.value = newValue
    })

    return this
  }

  minimum (a) {
    this.conversions.push(() => {
      if (this.value < a) {
        this.throwError(`is smaller than the minimum ${a}`)
      }
    })

    return this
  }

  maximum (b) {
    this.conversions.push(() => {
      if (this.value > b) {
        this.throwError(`is larger than the max ${b}`)
      }
    })

    return this
  }

  minLength (a) {
    this.conversions.push(() => {
      if (this.value.length < a) {
        this.throwError(`is shorter than min length of ${a} symbols`)
      }
    })

    return this
  }

  maxLength (b) {
    this.conversions.push(() => {
      if (this.value.length > b) {
        this.throwError(`is longer than the max length of ${b} symbols`)
      }
    })

    return this
  }

  nonEmpty () {
    this.conversions.push(() => {
      if (!this.value.length) {
        this.throwError('is empty')
      }
    })
    return this
  }

  toUuid () {
    this.conversions.push(() => {
      if (this.value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/g) === null) {
        this.throwError('should be an UUID')
      }
    })
    return this
  }

  toLatitude () {
    this.toFloat()
    this.minimum(-90.0)
    this.maximum(90.0)

    return this
  }

  toLongitude () {
    this.toFloat()
    this.minimum(-180.0)
    this.maximum(180.0)

    return this
  }

  /**
  * Converts from a ISO 8601 string to a moment.js object and
  * applies timezone conversion (defaults to UTC)
  * @param {string} tz
  * @return {Conversion}
  */
  toMoment (tz = 'UTC') {
    this.conversions.push(() => {
      const newValue = moment.tz(this.value, tz)

      if (isNaN(newValue)) {
        this.throwError('should be a ISO8601 DateTime string')
      }

      this.value = newValue
    })
    return this
  }

  /**
  * Converts from a ISO 8601 string or a UNIX epoch in milliseconds
  * to a moment.js object in UTC
  * @return {Conversion}
  */
  toMomentUtc () {
    this.conversions.push(() => {
      if (!isNaN(this.value)) {
        this.value = parseInt(this.value)
      }
      const newValue = moment.utc(this.value)
      if (!newValue.isValid()) {
        this.throwError('should be an ISO8601 timestamp or an UNIX epoch (ms)')
      }
      this.value = newValue
    })
    return this
  }

  toQuantumTime () {
    this.toMoment()
    this.conversions.push(() => {
      timeUtils.quantify(this.value)
    })
    return this
  }

  toDateString () {
    this.toMoment()
    this.conversions.push(() => {
      // timeUtils.quantify(this.value);
      this.value = moment(this.value).format('YYYY-MM-DD')
    })
    return this
  }

  toTimeInterval () {
    this.conversions.push(() => {
      if (!this.value.match(/^[0-9]+\w*[d|D|h|H|m|M|s|S]$/g)) {
        this.throwError('should be a time interval (e.g. "1d" for 1 day, "20m" for 20 minutes)')
      }
    })
    return this
  }

  toAggregateFunction () {
    this.conversions.push(() => {
      if (['count', 'sum', 'avg', 'min', 'max'].indexOf(this.value) === -1) {
        this.throwError('should be count, sum, avg, min, max')
      }
    })
    return this
  }

  toInt () {
    this.conversions.push(() => {
      const newValue = parseInt(this.value)

      if (isNaN(newValue)) {
        this.throwError('should be an integer')
      }

      this.value = newValue
    })
    return this
  }

  toNonNegativeInt () {
    this.toInt()
    this.minimum(0)

    return this
  }

  toString () {
    this.conversions.push(() => {
      this.value = this.value.toString()
    })
    return this
  }

  toLowerCase () {
    this.conversions.push(() => {
      this.value = this.value.toLowerCase()
    })
    return this
  }

  toUpperCase () {
    this.conversions.push(() => {
      this.value = this.value.toUpperCase()
    })
    return this
  }

  trim () {
    this.conversions.push(() => {
      this.value = this.value.trim()
    })
    return this
  }

  objToString () {
    this.conversions.push(() => {
      if (typeof (this.value) === 'object') {
        this.value = JSON.stringify(this.value)
      }
    })
    return this
  }

  toBoolean () {
    this.conversions.push(() => {
      this.value = (this.value.toString() === 'true' || this.value.toString() === '1')
    })
    return this
  }

  toArray () {
    this.conversions.push(() => {
      if (!Array.isArray(this.value)) {
        this.value = [this.value]
      }
    })
    return this
  }

  toIntArray () {
    this.conversions.push(() => {
      if (!Array.isArray(this.value)) {
        this.value = [this.value]
      }
      const result = []
      this.value.forEach(item => {
        const number = parseInt(item)
        if (isNaN(number)) {
          this.throwError('should be an array of integers')
        }
        result.push(number)
      })
      this.value = result
    })
  }

  toFloatArray () {
    this.conversions.push(() => {
      if (!Array.isArray(this.value)) {
        this.value = [this.value]
      }
      const result = []
      this.value.forEach(item => {
        const number = parseFloat(item)
        if (isNaN(number)) {
          this.throwError('should be an array of floats')
        }
        result.push(number)
      })
      this.value = result
    })
  }

  nonEmptyArrayItem () {
    this.conversions.push(() => {
      if (this.value.length === 1 && this.value[0].trim() === '') {
        this.throwError('is empty')
      }
    })
    return this
  }

  isObject () {
    this.conversions.push(() => {
      if (!(this.value === Object(this.value) && !Array.isArray(this.value) && typeof this.value !== 'function')) {
        this.throwError('is not an object')
      }
    })

    return this
  }

  isValidTimezone () {
    if (moment.tz.zone(this.src[this.property]) === null) {
      return this.throwError(`${this.src[this.property]} is not valid timezone`)
    };
    return this
  }

  isEqualToAny (arr) {
    this.conversions.push(() => {
      if (!arr.includes(this.value)) {
        this.throwError(`should be one of these values: ${arr.join(', ')}`)
      }
    })

    return this
  }
}
