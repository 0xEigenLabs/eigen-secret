const { Sequelize, DataTypes, Model } = require('sequelize');
require('dotenv').config();
import { require_env_variables } from "./util";

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
        storage: '/tmp/database.sqlite', // or ':memory:'
        dialect: dbDriver
    })
} else {
    sequelize = new Sequelize(dbName, dbUser, dbPassword, {
        host: dbHost,
        dialect: dbDriver
    })
}

export default sequelize;
