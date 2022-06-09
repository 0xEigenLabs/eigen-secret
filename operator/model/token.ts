// token.ts
/**
 * token definition
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
  storage: "./data/token_db.sqlite",
});

const tokendb = sequelize.define("token_st", {
  network_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
    primaryKey: true,
  },

  tokenAddress: {
    type: DataTypes.CITEXT,
    allowNull: false,
    primaryKey: true,
  },

  tokenType: {
      type: DataTypes.CITEXT,
      allowNull: false,
  },

});

sequelize
  .sync()
  .then(function () {
    return tokendb.create({
      network_id: "id",
      tokenAddress: "0x",
      tokenType: 1,
    });
  })
  .then(function (row: any) {
    consola.log(
      row.get({
        network_id: "id",
        tokenType: 1,
        tokenAddress: "0x",
      })
    );
    tokendb.destroy({
      where: {
        network_id: "id",
        tokenType: 1,
        tokenAddress: "0x",
      },
    });
  })
  .catch(function (err) {
    consola.log("Unable to connect to the database:", err);
  });

const add = function (network_id, tokenType, tokenAddress) {
  return tokendb.create({
    network_id,
    tokenAddress,
    tokenType,
  });
};

const findOne = function (filter_dict) {
  return tokendb.findOne({ where: filter_dict });
};
const findAll = function (dict) {
  return tokendb.findAll({ where: dict });
};

export { add, findOne, findAll };
