set -e
# EigenZKit

CIRCUIT=withdraw_signature_verifier
CIRCUIT_DIR=$(cd $(dirname $0);cd ../circuits;pwd)
ZKIT=`which zkit`
WORKSPACE=/tmp/zkit_zkzru_withdraw_signature
rm -rf $WORKSPACE && mkdir -p $WORKSPACE

POWER=20
SRS=${CIRCUIT_DIR}/setup_2^${POWER}.key
if [ ! -f $SRS ]; then
   curl https://universal-setup.ams3.digitaloceanspaces.com/setup_2^${POWER}.key -o $SRS
fi

cd $CIRCUIT_DIR

echo "1. Compile the circuit"
${ZKIT} compile -i $CIRCUIT.circom --O2=full -o $WORKSPACE
node ${CIRCUIT_DIR}/../scripts/generate_withdraw_signature_verifier.js
mv ${CIRCUIT_DIR}/input.json ${CIRCUIT_DIR}/withdraw_signature_verifier_js/

echo "2. Generate witness"
node ${WORKSPACE}/${CIRCUIT}_js/generate_witness.js ${WORKSPACE}/${CIRCUIT}_js/$CIRCUIT.wasm $CIRCUIT_DIR/withdraw_signature_verifier_js/input.json $WORKSPACE/witness.wtns

echo "3. Export verification key"
${ZKIT} export_verification_key -s ${SRS}  -c $WORKSPACE/$CIRCUIT.r1cs -v $WORKSPACE/vk.bin

echo "4. prove"
${ZKIT} prove -c $WORKSPACE/$CIRCUIT.r1cs -w $WORKSPACE/witness.wtns -s ${SRS} -b $WORKSPACE/proof.bin

echo "5. Verify the proof"
${ZKIT} verify -p $WORKSPACE/proof.bin -v $WORKSPACE/vk.bin

echo "6. Generate verifier"
${ZKIT} generate_verifier -v $WORKSPACE/vk.bin -s ${CIRCUIT_DIR}/../contracts/zkit_withdraw_signature_verifier.sol

mv -f proof.json public.json ./withdraw_signature_verifier_js

sed -i.bak 's/contract KeyedVerifier/contract WithdrawSignatureKeyedVerifier/g' ${CIRCUIT_DIR}/../contracts/zkit_withdraw_signature_verifier.sol