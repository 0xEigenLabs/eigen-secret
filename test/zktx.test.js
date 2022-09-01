const client = require("../");
const { expect } = require("chai");

const main = async() => {
  // run scripts/zkit_zktx.sh to generates the circuits
  let circult_path = "/tmp/zkit_zktx/"
  let zktx = new client.ZKTX(circult_path);
  await zktx.initialize()

  let senderPvk = zktx.twistedElGamal.random(32);
  let senderPubk = zktx.twistedElGamal.pubkey(senderPvk);
  console.log(senderPubk)

  let receiverPvk = zktx.twistedElGamal.random(32);
  console.log(receiverPvk)
  let receiverPubk = zktx.twistedElGamal.pubkey(receiverPvk);

  let amount = 10;
  let nonce = 1;
  let tokenType = 1;
  let tx = await zktx.createTX(amount + 1, amount, senderPvk, nonce, tokenType, receiverPubk)

  console.log(tx);

  // verify tx
  let verified = await zktx.verifyTX(amount, senderPubk, receiverPubk, nonce, tokenType, tx.signature, tx.proof)
  expect(verified).eq(true)
}


describe('ZKTX',async function() {
  describe('createTX', async function() {
    it('should be able to create tx', async function() {
      await main()
    });
  });
});
