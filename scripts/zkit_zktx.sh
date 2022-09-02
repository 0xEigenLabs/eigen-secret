set -e
# EigenZKit

CIRCUIT=zktx
CIRCUIT_DIR=$(cd $(dirname $0);cd ../circuits;pwd)
ZKIT=`which zkit`
WORKSPACE=/tmp/zkit_zktx
mkdir -p $WORKSPACE

POWER=15
SRS=${WORKSPACE}/setup_2^${POWER}.key

if [ ! -f $SRS ]; then
#   curl https://universal-setup.ams3.digitaloceanspaces.com/setup_2^${POWER}.key -o $SRS
    ${ZKIT} setup -p ${POWER} -s ${SRS}
fi


cd $CIRCUIT_DIR

echo "1. Compile the circuit"
${ZKIT} compile -i $CIRCUIT.circom --O2=full -o $WORKSPACE

node ${CIRCUIT_DIR}/../scripts/generate_zktx.js ${WORKSPACE}/zktx_js/

echo "2. Generate witness"
node ${WORKSPACE}/${CIRCUIT}_js/generate_witness.js ${WORKSPACE}/${CIRCUIT}_js/$CIRCUIT.wasm $WORKSPACE/zktx_js/input.json $WORKSPACE/witness.wtns

echo "3. Export verification key"
${ZKIT} export_verification_key -s ${SRS}  -c $WORKSPACE/$CIRCUIT.r1cs -v $WORKSPACE/vk.bin

echo "4. prove"
${ZKIT} prove -c $WORKSPACE/$CIRCUIT.r1cs -w $WORKSPACE/witness.wtns -s ${SRS} -b $WORKSPACE/proof.bin

echo "5. Verify the proof"
${ZKIT} verify -p $WORKSPACE/proof.bin -v $WORKSPACE/vk.bin
