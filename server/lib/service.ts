// service.ts
/**
 * The entry point for eigen_service
 *
 * @module main
 */

import express from "express";
import cors from "cors";
import consola from "consola";
import { BasicReporter } from "consola";
import "dotenv/config";
import bodyParser from "body-parser";
import { getAccount, createAccount } from "./account";
import { createTx, getTxByAlias, updateStateTree, updateNotes, getNotes } from "./transaction";
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
app.post("/transactions/create", createTx);
app.post("/transactions/get", getTxByAlias);
app.post("/statetree", updateStateTree);
app.post("/notes/update", updateNotes);
app.post("/notes/get", getNotes);
app.post("/proof/create", submitProofs);
app.post("/proof/get", getProofs);

export default app;
