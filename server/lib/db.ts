const { Sequelize } = require("sequelize");
require("dotenv").config();
import * as utils from "@eigen-secret/core/dist-node/utils";
import consola from "consola";

const { requireEnvVariables } = utils

requireEnvVariables(["DB_NAME", "DB_USER", "DB_HOST", "DB_DRIVER", "DB_PASSWORD"]);

const dbName = process.env.DB_NAME as string
const dbUser = process.env.DB_USER as string
const dbHost = process.env.DB_HOST
const dbDriver = process.env.DB_DRIVER as string
const dbPassword = process.env.DB_PASSWORD

// const cls = require('cls-hooked');
// const namespace = cls.createNamespace('db-user-ns');
// Sequelize.useCLS(namespace);

let sequelize: any;
if (dbDriver == "sqlite") {
    // only for test
    sequelize = new Sequelize(dbName, dbUser, dbPassword, {
        host: dbHost,
        storage: ":memory:",
        //storage: "/tmp/db.sqlite",
        dialect: dbDriver,
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
} else {
    sequelize = new Sequelize(dbName, dbUser, dbPassword, {
        host: dbHost,
        dialect: dbDriver,
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
}

sequelize
.sync({ force: true })
.catch(function(err: any) {
    consola.log("Unable to connect to the database:", err);
});

export default sequelize;
