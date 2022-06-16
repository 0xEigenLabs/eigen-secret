import fs from 'fs'
import Account from '../src/account'
import Tree from '../src/tree'

const ACCOUNT_DEPTH = 8;
/* 
   generate empty nodes for an accounts tree of depth 8
 */

const main = async() => {

    const zeroLeaf = new Account()
    await zeroLeaf.initialize()
    const zeroHash = await zeroLeaf.hashAccount()

    console.log('zeroHash', zeroHash)

    const numLeaves = 2**ACCOUNT_DEPTH

    const leaves = new Array(numLeaves).fill(zeroHash)

    const zeroTree = new Tree(leaves)

    console.log('root', zeroTree.root)

    var zeroCache = [zeroHash]

    // root at zeroCache[0]
    for (var i = ACCOUNT_DEPTH - 1; i >= 0; i--){
        zeroCache.unshift(zeroTree.innerNodes[i][0])
    }

    fs.writeFileSync('../config/zeroCache.json', JSON.stringify(zeroCache, null, 4))
}

main().then(() => {
})
