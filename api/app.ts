// app.ts
/**
 * The entry point for eigen_service
 *
 * @module main
 */

import express from "express";
import jwt from "express-jwt";
import cors from "cors";
import consola from "consola";
import { BasicReporter } from "consola";
import "dotenv/config";

// Use basic reporter instead, disable color printing
consola.setReporters([new BasicReporter()]);

import * as log4js from "./log";
import * as util from "../api/util";

import bodyParser from "body-parser";
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(log4js.useLog());
const issueOptions = {
  origin: true,
  credentials: true
};

app.use(cors(issueOptions));

util.require_env_variables(["JWT_SECRET"]);

const filterFunc = function(req: { url: string; method: string; }) {
  if (process.env.DEBUG_MODE) {
    return true;
  }
  consola.info(req.url);
  const bypass = [];
  consola.info(bypass.indexOf(req.url), req.method);
  if (bypass.indexOf(req.url) >= 0 && req.method == "GET") {
    return true;
  }
  return false;
};

app.use(
  jwt({
    secret: process.env.JWT_SECRET,
    algorithms: ["HS256"],
    credentialsRequired: false
  }).unless(filterFunc)
);

app.listen(3000, function() {
  consola.log("hello world!");
});
