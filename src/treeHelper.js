const buildMimc7 = require("circomlibjs").buildMimc7;

let mimcjs
module.exports = {
  async initialize() {
    mimcjs = await buildMimc7()
  },

  rootFromLeafAndPath(leaf, idx, merkle_path) {
    if (merkle_path.length > 0) {
      const depth = merkle_path.length;
      const merkle_path_pos = module.exports.idxToBinaryPos(idx, depth)
      let root = new Array(depth);
      let left
      let right

      if (merkle_path_pos[0] == 0) {
        left = (leaf);
        right = (merkle_path[0]);
      } else {
        left = (merkle_path[0])
        right = (leaf);
      }
      root[0] = mimcjs.multiHash([left, right]);
      for (let i = 1; i < depth; i++) {
        if (merkle_path_pos[i] == 0) {
          left = (root[i - 1]);
          right = (merkle_path[i])
        } else {
          left = (merkle_path[i])
          right = (root[i - 1]);
        }
        root[i] = mimcjs.multiHash([left, right]);
      }
      return root[depth - 1];
    } else {
      return leaf
    }
  },

  innerNodesFromLeafAndPath(leaf, idx, merkle_path) {
    if (merkle_path.length > 0) {
      const depth = merkle_path.length;
      const merkle_path_pos = module.exports.idxToBinaryPos(idx, depth)
      let innerNodes = new Array(depth);
      let left
      let right

      if (merkle_path_pos[0] == 0) {
        left = (leaf);
        right = (merkle_path[0]);
      } else {
        left = (merkle_path[0])
        right = (leaf);
      }

      innerNodes[0] = mimcjs.multiHash([left, right]);
      for (let i = 1; i < depth; i++) {
        if (merkle_path_pos[i] == 0) {
          left = (innerNodes[i - 1]);
          right = (merkle_path[i]);
        } else {
          left = (merkle_path[i])
          right = (innerNodes[i - 1]);
        }
        innerNodes[i] = mimcjs.multiHash([left, right]);
      }
      return innerNodes;
    } else {
      return leaf
    }
  },

  proofPos: function(leafIdx, treeDepth) {
    let proofPos = new Array(treeDepth);
    let proofBinaryPos = module.exports.idxToBinaryPos(leafIdx, treeDepth);

    if (leafIdx % 2 == 0) {
      proofPos[0] = leafIdx + 1;
    } else {
      proofPos[0] = leafIdx - 1;
    }

    for (let i = 1; i < treeDepth; i++) {
      if (proofBinaryPos[i] == 1) {
        proofPos[i] = Math.floor(proofPos[i - 1] / 2) - 1;
      } else {
        proofPos[i] = Math.floor(proofPos[i - 1] / 2) + 1;
      }
    }

    return (proofPos)
  },

  getAffectedPos: function(proofPos) {
    let affectedPos = new Array(proofPos.length);

    // skip the first node in the proof since it is not affected
    for (let i = 1; i < proofPos.length; i++) {
      // if proof node has odd index (i.e. is the right sibling)
      if (proofPos[i] & 1) {
        affectedPos[i - 1] = proofPos[i] - 1; // affected node is left sibling
        // if proof node has even index (i.e. is the left sibling)
      } else {
        affectedPos[i - 1] = proofPos[i] + 1; // affected node is right sibling
      }
    }

    affectedPos[proofPos.length - 1] = 0; // the root

    return affectedPos;
  },

  binaryPosToIdx: function(binaryPos) {
    let idx = 0;
    for (let i = 0; i < binaryPos.length; i++) {
      idx = idx + binaryPos[i] * (2 ** i)
    }
    return idx;
  },

  idxToBinaryPos: function(idx, binLength) {
    let binString = idx.toString(2);
    let binPos = Array(binLength).fill(0)
    for (let j = 0; j < binString.length; j++) {
      binPos[j] = Number(binString.charAt(binString.length - j - 1));
    }
    return binPos;
  },

  pairwiseHash: function(array) {
    if (array.length % 2 == 0) {
      let arrayHash = []
      for (let i = 0; i < array.length; i = i + 2) {
        arrayHash.push(mimcjs.multiHash(
            [(array[i]), (array[i + 1])]
        ))
      }
      return arrayHash
    } else {
      console.log("array must have even number of elements")
    }
  },

  getBase2Log: function(y) {
    return Math.log(y) / Math.log(2);
  },

  // fill an array with a fillerLength copies of a value
  padArray: function(leafArray, padValue, length) {
    if (Array.isArray(leafArray)) {
      let arrayClone = leafArray.slice(0)
      const nearestPowerOfTwo = Math.ceil(module.exports.getBase2Log(leafArray.length))
      const diff = length - leafArray.length || 2 ** nearestPowerOfTwo - leafArray.length
      for (let i = 0; i < diff; i++) {
        arrayClone.push(padValue)
      }
      return arrayClone
    } else {
      console.log("please enter pubKeys as an array")
    }
  }
}
