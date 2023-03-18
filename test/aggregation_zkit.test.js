const { promisify } = require('util');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const bigPower = 23;
const power = 18;
const numInputs = 8;

const curDir = path.join(__dirname, "..", "circuits");
console.log(curDir);
const circuit = 'main_update_state';
const workspace = path.resolve(__dirname, "..", 'tmp/aggregation');
console.log(workspace);
fs.rmdirSync(workspace, { recursive: true });
fs.mkdirSync(workspace, { recursive: true });

const srs = path.join(curDir, `keys/setup_2^${power}.key`);
console.log(srs);
const bigSrs = path.join(curDir, `keys/setup_2^${bigPower}.key`);
console.log(bigSrs);

const execAsync = promisify(exec);

async function run() {
  if (!fs.existsSync(bigSrs)) {
    await execAsync(`zkit setup -p ${bigPower} -s ${bigSrs}`);
  }

  console.log('1. compile circuit');
  await execAsync(`zkit compile -i ${curDir}/${circuit}.circom --O2=full -o ${workspace}`);

  console.log('2. export verification key');
  await execAsync(`zkit export_verification_key -s ${srs} -c ${workspace}/${circuit}.r1cs -v ${workspace}/vk.bin`);

  console.log('3. generate each proof');
  const inputDir = path.join(curDir, 'aggregation/input');
  const inputDirs = fs.readdirSync(inputDir);
  for (const input of inputDirs) {
    const inputPath = path.join(inputDir, input);
    const generateWitnessCmd = `node ${workspace}/${circuit}_js/generate_witness.js ${workspace}/${circuit}_js/${circuit}.wasm ${inputPath}/input.json ${inputPath}/witness.wtns`;
    await execAsync(generateWitnessCmd);
    const proveCmd = `zkit prove -c ${workspace}/${circuit}.r1cs -w ${inputPath}/witness.wtns -b ${inputPath}/proof.bin -s ${srs} -j ${inputPath}/proof.json -t rescue`;
    await execAsync(proveCmd);
    const verifyCmd = `zkit verify -p ${inputPath}/proof.bin -v ${workspace}/vk.bin -t rescue`;
    await execAsync(verifyCmd);
  }

  console.log('4. collect old proof list');
  const oldProofList = path.join(workspace, 'old_proof_list.txt');
  fs.writeFileSync(oldProofList, '');
  let i = 0;
  for (const input of inputDirs) {
    const inputPath = path.join(curDir, 'aggregation/input', input);
    const proofBinPath = path.join(inputPath, 'proof.bin');
    fs.appendFileSync(oldProofList, `${proofBinPath}\n`);
    i++;
  }

  console.log('5. export aggregation vk');
  await execAsync(`zkit export_aggregation_verification_key -c ${i} -i ${numInputs} -s ${bigSrs} -v ${workspace}/aggregation_vk.bin`);

  console.log('6. generate aggregation proof');
  const aggregationProofPath = path.join(workspace, 'aggregation_proof.bin');
  const aggregationProofJsonPath = path.join(workspace, 'aggregation_proof.json');
  const generateAggregationProofCmd = `zkit aggregation_prove -s ${bigSrs} -f ${oldProofList} -v ${workspace}/vk.bin -n ${aggregationProofPath} -j ${aggregationProofJsonPath}`;
  await execAsync(generateAggregationProofCmd);
  
  console.log('7. verify');
  const aggregationVerifyCmd = `zkit aggregation_verify -p ${aggregationProofPath} -v ${workspace}/aggregation_vk.bin`;
  await execAsync(aggregationVerifyCmd);
  
  console.log('8. generate verifier');
  const generateAggregationVerifierCmd = `zkit generate_aggregation_verifier -o ${workspace}/vk.bin -n ${workspace}/aggregation_vk.bin -i ${numInputs} -s ${curDir}/aggregation/contracts/verifier.sol`;
  await execAsync(generateAggregationVerifierCmd);
  
  console.log('9. run verifier test');
  const aggregationDir = path.join(curDir, 'aggregation');
  const runVerifierTestCmd = `cd ${aggregationDir} && npm run test`;
  await execAsync(runVerifierTestCmd);
  
}

run().then(() => {
  console.log('Done');
  process.exit();
})