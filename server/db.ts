const { Sequelize, DataTypes, Model } = require("sequelize");
require("dotenv").config();
import { require_env_variables } from "./util";
import consola from "consola";

require_env_variables(["DB_NAME", "DB_USER", "DB_HOST", "DB_DRIVER", "DB_PASSWORD"]);

const dbName = process.env.DB_NAME as string
const dbUser = process.env.DB_USER as string
const dbHost = process.env.DB_HOST
const dbDriver = process.env.DB_DRIVER as string
const dbPassword = process.env.DB_PASSWORD

let sequelize: any;
if (dbDriver == "sqlite") {
    // only for test
    sequelize = new Sequelize(dbName, dbUser, dbPassword, {
        host: dbHost,
        storage: ":memory:",
        dialect: dbDriver,
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
        pool: {
            max: 100,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    })
}

sequelize
.sync()
.catch(function(err: any) {
    consola.log("Unable to connect to the database:", err);
});

export default sequelize;
