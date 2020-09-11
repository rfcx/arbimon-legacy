var Conversion = require('./conversion')
var ValidationError = require('./validation-error')
var Promise = require('bluebird')

module.exports = class Converter {
  constructor (validatedObject, transformedObject) {
    if (validatedObject instanceof Converter) {
      validatedObject = validatedObject.validatedObject
    }
    this.validatedObject = validatedObject
    this.currentValue = null
    this.currentProperty = null
    this.transformedObject = transformedObject || {}
    this.conversions = []
  };

  convert (property) {
    const conversion = new Conversion(this.validatedObject, property, this.transformedObject)
    this.conversions.push(conversion)
    return conversion
  }

  validate () {
    return Promise.resolve()
      .then(() => {
        const exceptions = []
        for (var conversion of this.conversions) {
          try {
            conversion.execute()
          } catch (e) {
            exceptions.push(e.message)
          }
        }
        if (exceptions.length === 0) {
          return this.transformedObject
        } else {
          throw new ValidationError(`Validation errors: ${exceptions.join('; ')}.`)
        }
      })
  }
}
