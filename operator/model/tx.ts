// tx.ts
/**
 * tx definition
 *
 * @module database
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Sequelize, DataTypes } from "sequelize";
import consola from "consola";

const sequelize = new Sequelize({
  dialect: "sqlite",

  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  storage: "./data/tx_db.sqlite",
});

const l2txdb = sequelize.define("tx_st", {
  network_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
    primaryKey: true,
  },

  txid: {
    type: DataTypes.CITEXT,
    allowNull: false,
    primaryKey: true,
  },

  senderPubkey: {
      type: DataTypes.CITEXT,
      allowNull: false,
  },

  signature: {
      type: DataTypes.STRING,
      allowNull: false,
  },

  receiverPubkey: {
      type: DataTypes.CITEXT,
      allowNull: false
  },

  tokenTypeFrom: {
      type: DataTypes.INTEGER,
      allowNull: false,
  },

  amount: {
    allowNull: false,
    type: DataTypes.STRING,
  },

  nonce: {
      allowNull: false,
      type: DataTypes.BIGINT,
  },

  index: {
      allowNull: false,
      type: DataTypes.BIGINT,
  },

  txRoot: {
      allowNull: false,
      type: DataTypes.STRING,
  },

  position: {
      allowNull: false,
      type: DataTypes.STRING,
  },

  proof: {
      allowNull: false,
      type: DataTypes.STRING,
  },
});

sequelize
  .sync()
  .then(function () {
    return l2txdb.create({
      network_id: "id",
      senderPubkey: "0xUSER", //public key
      receiverPubkey: "0xUSER", //public key
      tokenType: 1,
      balance: "100",
      nonce: 1,
    });
  })
  .then(function (row: any) {
    consola.log(
      row.get({
        address: "0xUSER",
        tokenType: 1,
        nonce: 1,
      })
    );
    l2txdb.destroy({
      where: {
        address: "0xUSER",
        tokenType: 1,
        nonce: 1,
      },
    });
  })
  .catch(function (err) {
    consola.log("Unable to connect to the database:", err);
  });

const add = function (network_id, senderPubkey, receiverPubkey, index, amount, nonce, tokenTypeFrom, txRoot, position, proof) {
  return l2txdb.create({
    network_id,
    senderPubkey,
    receiverPubkey,
    index,
    amount,
    nonce,
    tokenTypeFrom,
    txRoot,
    position,
    proof
  });
};

const findOne = function (filter_dict) {
  return l2txdb.findOne({ where: filter_dict });
};
const findAll = function (dict) {
  return l2txdb.findAll({ where: dict });
};

export { add, findOne, findAll };
