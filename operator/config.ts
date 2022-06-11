// requires
const _ = require("lodash");

// module variables
const config = require("../config.json");
const defaultConfig = config.development;
const environment = process.env.NODE_ENV || "development";
const environmentConfig = config[environment];
export const gConfig = _.merge(defaultConfig, environmentConfig);
