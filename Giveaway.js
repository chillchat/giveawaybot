module.exports = class Giveaway {
  /**
   *Creates an instance of Givewaway.
   * @param {Object} options
   * @param {String} options.item
   * @param {Number} options.duration
   * @param {Number} options.endTime
   * @param {String} options.id
   * @param {String} options.provider
   * @param {String} options.msgID
   * @param {string} options.channelID
   */
  constructor(options) {
    for (const option in options) {
      if (options.hasOwnProperty(option)) {
        this[option] = options[option];
      }
    }
    this.users = []
  }
}