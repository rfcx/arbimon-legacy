class SongMeterFileInfo {
  metadata = ''

  constructor (metadata) {
    this.metadata = metadata
  }

  get formattedMetadata () {
    // eslint-disable-next-line no-control-regex, no-useless-escape
    const formatted = (this.metadata.replace(/\n/g, ';')).replace(/[\[\]\{\}\"\x07]/g, '')
    return formatted
  }

  get model () {
    const reg = /Model:(?<model>.*)/ig
    try {
      const matched = reg.exec(this.metadata)
      if (!matched || matched.length === 0) {
        return null
      }
      return matched.groups.model
    } catch (e) {
      return null
    }
  }
}

module.exports = SongMeterFileInfo;
