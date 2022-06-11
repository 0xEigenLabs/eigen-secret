import fs from 'fs'
import Account from '../src/account'
import Tree from '../src/tree'

import { gConfig } from "./config";

/* 
   generate empty nodes for an accounts tree of depth 32
 */

const main = async() => {

    const zeroLeaf = new Account()
    await zeroLeaf.initialize()
    const zeroHash = await zeroLeaf.hashAccount()

    console.log('zeroHash', zeroHash)

    const depth = gConfig.account_depth
    const numLeaves = 2**depth

    const leaves = new Array(numLeaves).fill(zeroHash)

    const zeroTree = new Tree(leaves)

    console.log('root', zeroTree.root)

    var zeroCache = [zeroHash]

    // root at zeroCache[0]
    for (var i = depth - 1; i >= 0; i--){
        zeroCache.unshift(zeroTree.innerNodes[i][0])
    }

    fs.writeFileSync('../config/zeroCache.json', JSON.stringify(zeroCache, null, 4))
}

main().then(() => {
})
