const fs = require("fs");

const plonkVerifierRegex = /contract KeyedVerifier/

let content = fs.readFileSync("../contracts/zkit_update_state_verifier.sol", { encoding: 'utf-8' });
let bumped = content.replace(plonkVerifierRegex, 'contract UpdateStateKeyedVerifier');

fs.writeFileSync("../contracts/zkit_update_state_verifier.sol", bumped);