const buildEddsa = require("circomlibjs").buildEddsa;

module.exports = {
  async generatePubkey(prvkey) {
    let eddsa = await buildEddsa()
    return eddsa.prv2pub(prvkey)
  }
}
