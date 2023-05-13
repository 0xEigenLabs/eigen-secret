// service.ts
/**
 * The entry point for eigen_service
 *
 * @module main
 */

import express from "express";
import "express-async-errors";
import cors from "cors";
import consola from "consola";
import { BasicReporter } from "consola";
import "dotenv/config";
import bodyParser from "body-parser";
import { updateAccount, createAccount, getAccount } from "./account";
import { createTx, getTxByAlias, updateStateTree, getNotes } from "./transaction";
import { createToken, getToken, getTokenPrices } from "./token";
import { submitProofs, getProofs } from "./proof";
// Use basic reporter instead, disable color printing
consola.setReporters([new BasicReporter()]);

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const issueOptions = {
  origin: true,
  credentials: true
};
// TODO: api versioning
app.use(cors(issueOptions));

app.post("/accounts/create", createAccount);
app.post("/accounts/get", getAccount);
app.post("/accounts/update", updateAccount);

app.post("/transactions/create", createTx);
app.post("/transactions/get", getTxByAlias);

app.post("/statetree", updateStateTree);

app.post("/notes/get", getNotes);

app.post("/proof/create", submitProofs);
app.post("/proof/get", getProofs);

app.post("/token/price", getTokenPrices);
app.post("/token/create", createToken);
app.post("/token/get", getToken)

export default app;
