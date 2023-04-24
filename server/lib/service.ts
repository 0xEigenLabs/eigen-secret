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
import * as utils from "@eigen-secret/core/dist-node/utils";
import bodyParser from "body-parser";
import { createAccount } from "./account";
import { createTx, getTxByAlias, updateStateTree, updateNotes, getNotes } from "./transaction";

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

app.post("/accounts/:ethAddress", createAccount);
app.post("/transactions", createTx);
app.post("/statetree", updateStateTree);
app.get("/transactions/:alias", getTxByAlias); // TODO: get not allowed
app.post("/notes/update", updateNotes);
app.post("/notes/get", getNotes);
app.get("/ping", (req, resp) => {
  resp.json(utils.succ("pong"));
})

export default app;
