// database.ts
/**
 * tx and account definition
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
  storage: "./data/account_db.sqlite",
});

const accountdb = sequelize.define("account_st", {
  network_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
    primaryKey: true,
  },

  index: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  pubkey: {
    type: DataTypes.CITEXT,
    allowNull: false,
    primaryKey: true,
  },

  tokenType: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  balance: {
    allowNull: false,
    type: DataTypes.STRING,
  },

  nonce: {
    allowNull: false,
    type: DataTypes.BIGINT,
  },
});

sequelize
  .sync()
  .then(function () {
    return accountdb.create({
      network_id: "id",
      pubkey: "0xUSER",
      tokenType: 1,
      balance: "100",
      nonce: 1,
    });
  })
  .then(function (row: any) {
    consola.log(
      row.get({
        pubkey: "0xUSER",
        tokenType: 1,
        nonce: 1,
      })
    );
    accountdb.destroy({
      where: {
        pubkey: "0xUSER",
        tokenType: 1,
        nonce: 1,
      },
    });
  })
  .catch(function (err) {
    consola.log("Unable to connect to the database:", err);
  });

const add = function (network_id, index, pubkey, tokenType, balance, nonce) {
  return accountdb.create({
    network_id,
    index,
    pubkey,
    tokenType,
    balance,
    nonce,
  });
};

const findOne = function (filter_dict) {
  return accountdb.findOne({ where: filter_dict });
};
const findAll = function (dict) {
  return accountdb.findAll({ where: dict });
};

export { add, findOne, findAll };
