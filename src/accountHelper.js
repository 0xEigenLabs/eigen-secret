const buildEddsa = require("circomlibjs").buildEddsa;

module.exports = {
    async generatePubkey(prvkey) {
      let eddsa = await buildWEddsa()
      return eddsa.prv2pub(prvkey)
    }
}
