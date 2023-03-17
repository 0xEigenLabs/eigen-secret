// app.ts
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
import * as util from "./util";
import bodyParser from "body-parser";
import { createAccount } from "./account";
import { createTx, getTxByAccountId } from "./transaction";

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
app.post("/txs/", createTx);
app.get("/txs/:alias", getTxByAccountId);
app.get("/ping", (req, resp) => {
  resp.json(util.succ("pong"));
})

export default app;
