import fs from 'fs'
import Account from '../src/account'
import Tree from '../src/tree'
import {stringifyBigInts, unstringifyBigInts} from '../src/helpers/stringifybigint.js'

/* 
    generate empty nodes for an accounts tree of depth 32
*/

const zeroLeaf = new Account(0,'0','0',0,0,0)
const zeroHash = zeroLeaf.hashAccount()

console.log('zeroHash', zeroHash)

const depth = global.gConfig.account_depth
const numLeaves = 2**depth

const leaves = new Array(numLeaves).fill(zeroHash)

const zeroTree = new Tree(leaves)

console.log('root', zeroTree.root)

var zeroCache = [stringifyBigInts(zeroHash)]

// root at zeroCache[0]
for (var i = depth - 1; i >= 0; i--){
    zeroCache.unshift(stringifyBigInts(zeroTree.innerNodes[i][0]))
}

fs.writeFileSync('./config/zeroCache.json', JSON.stringify(zeroCache, null, 4))
