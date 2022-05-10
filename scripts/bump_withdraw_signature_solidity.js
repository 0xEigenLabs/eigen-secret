const fs = require("fs");

const plonkVerifierRegex = /contract KeyedVerifier/

let content = fs.readFileSync("../contracts/zkit_withdraw_signature_verifier.sol", { encoding: 'utf-8' });
let bumped = content.replace(plonkVerifierRegex, 'contract WithdrawSignatureKeyedVerifier');

fs.writeFileSync("../contracts/zkit_withdraw_signature_verifier.sol", bumped);