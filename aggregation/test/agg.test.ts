const { promisify } = require('util');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { AggregationProver } = require('../src/aggregation_prover');
const bigPower = 23;
const power = 18;
const srs = path.join(__dirname, '..', `keys/setup_2^${power}.key`);
const bigSrs = path.join(__dirname, '..', `keys/setup_2^${bigPower}.key`);

const execAsync = promisify(exec);

describe("Plonk aggregation verifier test", async function() {
  if (!fs.existsSync(srs)) {
    await execAsync(`zkit setup -p ${power} -s ${srs}`);
  }
  if (!fs.existsSync(bigSrs)) {
    await execAsync(`zkit setup -p ${bigPower} -s ${bigSrs}`);
  }
  it("verifier test", async () => {
    const aggregationProver = new AggregationProver();
    console.log('1. compile circuit');
    await aggregationProver.compileCircuit();
    console.log('2. export verification key');
    await aggregationProver.exportVerificationKey();
    console.log('3. generate each proof');
    await aggregationProver.generateEachProof();
    console.log('4. collect old proof list and export aggregation vk');
    await aggregationProver.exportAggregationVk();
    console.log('5. generate aggregation proof');
    await aggregationProver.generateAggregationProof();
    console.log('6. verify');
    await aggregationProver.verify();
    console.log('7. generate verifier(.sol)');
    await aggregationProver.generateVerifier();
    console.log('8. run verifier test');
    await aggregationProver.runVerifierTest();
  })
});
