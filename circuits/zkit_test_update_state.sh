set -e
# EigenZKit

CIRCUIT=update_state_verifier
CUR_DIR=$(cd $(dirname $0);pwd)
ZKIT="/home/ubuntu/workspace/ieigen/EigenZKit/target/release/zkit"
WORKSPACE=/tmp/zkit_zkzru_update_state
rm -rf $WORKSPACE && mkdir -p $WORKSPACE

SRS=/home/ubuntu/Downloads/setup_2^20.key

cd $CUR_DIR

echo "1. Compile the circuit"
${ZKIT} compile -i $CIRCUIT.circom --O2=full -o $WORKSPACE

echo "2. Generate witness"
node ${WORKSPACE}/${CIRCUIT}_js/generate_witness.js ${WORKSPACE}/${CIRCUIT}_js/$CIRCUIT.wasm $CUR_DIR/update_state_verifier_js/input.json $WORKSPACE/witness.wtns

echo "3. Export verification key"
${ZKIT} export_verification_key -s ${SRS}  -c $WORKSPACE/$CIRCUIT.r1cs -v $WORKSPACE/vk.bin

echo "4. prove"
${ZKIT} prove -c $WORKSPACE/$CIRCUIT.r1cs -w $WORKSPACE/witness.wtns -s ${SRS} -b $WORKSPACE/proof.bin

echo "5. Verify the proof"
${ZKIT} verify -p $WORKSPACE/proof.bin -v $WORKSPACE/vk.bin

echo "6. Generate verifier"
${ZKIT} generate_verifier -v $WORKSPACE/vk.bin -s zkit_zkzru_update_state/contracts/verifier.sol

echo "7. run verifier test"
cd $CUR_DIR/zkit_zkzru_update_state && yarn test
