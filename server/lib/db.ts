const { Sequelize } = require("sequelize");
require("dotenv").config();
import * as utils from "@eigen-secret/core/dist-node/utils";
import consola from "consola";
const dbConfig = require("../config/config.json");

const { requireEnvVariables } = utils
requireEnvVariables(["NODE_ENV"]);

const parseConfig = () => {
    switch (process.env.NODE_ENV) {
        case "development":
            return dbConfig.development;
        case "production":
            return dbConfig.production;
        default:
            return dbConfig.test;
    }
}

const config = parseConfig();

let sequelize = new Sequelize(config.database, config.user, config.password, {
    host: config.host,
    storage: config.storage,
    dialect: config.dialect,
    dialectOptions: {
        supportBigNumbers: true
    },
    pool: {
        max: 100,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
})

sequelize
.sync({ force: false }) // don't drop table when launching
.catch(function(err: any) {
    consola.log("Unable to connect to the database:", err);
});

export default sequelize;
