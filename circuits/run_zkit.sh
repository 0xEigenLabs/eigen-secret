# EigenZKit
set -ex

CIRCUIT=main_update_state
CUR_DIR=$(cd $(dirname $0);pwd)
POWER=18
# install zkit from https://github.com/0xEigenLabs/eigen-zkvm/releases/tag/v0.0.2
ZKIT="eigen-zkit"
WORKSPACE=/tmp/secret
rm -rf $WORKSPACE && mkdir -p $WORKSPACE

SRS=${WORKSPACE}/setup_2^${POWER}.key

cd $CUR_DIR

if [ ! -f $SRS ]; then
    ${ZKIT} setup -p ${POWER} -s ${SRS}
fi

echo "1. Compile the circuit"
${ZKIT} compile -i $CIRCUIT.circom --O2=full -o $WORKSPACE

echo "2. Generate witness"
node ${WORKSPACE}/${CIRCUIT}_js/generate_witness.js ${WORKSPACE}/${CIRCUIT}_js/$CIRCUIT.wasm $CUR_DIR/main_update_state.input.json $WORKSPACE/witness.wtns

echo "3. Export verification key"
${ZKIT} export_verification_key -s ${SRS}  -c $WORKSPACE/$CIRCUIT.r1cs -v $WORKSPACE/vk.bin

echo "4. prove"
${ZKIT} prove -c $WORKSPACE/$CIRCUIT.r1cs -w $WORKSPACE/witness.wtns -s ${SRS} -b $WORKSPACE/proof.bin

echo "5. Verify the proof"
${ZKIT} verify -p $WORKSPACE/proof.bin -v $WORKSPACE/vk.bin
