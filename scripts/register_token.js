/*
 To use this file, run with => node register_token.js --tokenAddress=xxx --approveAmount=xxx
 tokenAddress is the token contract address, approveAmount is the amount your want to approve RollupNC contract to use.
*/
const {ethers} = require("hardhat");
const hre = require('hardhat')

const privateKey = process.env.DEVNET_PRIVKEY || process.exit(-1)
const rollupNCAddress = process.env.ROLLUPNC_ADDRESS || process.exit(-1)
const args = require('minimist')(process.argv.slice(2))

const main = async() => {
    const tokenAddress = args['tokenAddress']
    const approveAmount = args['approveAmount']

    let owner = new ethers.Wallet(privateKey)

    const rollupNCArtifact = await hre.artifacts.readArtifact('RollupNC')
    const rollupNCABI = rollupNCArtifact.abi
    let rollupNC = new ethers.Contract(
        rollupNCAddress,
        rollupNCABI,
        owner
    )

    // register token
    let registerToken = await rollupNC.connect(owner).registerToken(tokenAddress)
    if (registerToken == false) {
        throw 'Register Token failed!'
    }

    // approve token
    let approveToken = await rollupNC.connect(owner).approveToken(tokenAddress)
    if (approveToken == false) {
        throw 'Approve Token failed!'
    }
}

main().then(() => {
    console.log("Done with token registery!")
})