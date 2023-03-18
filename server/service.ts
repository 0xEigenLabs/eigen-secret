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
import * as utils from "../src/utils";
import bodyParser from "body-parser";
import { createAccount } from "./account";
import { createTx, getTxByAccountId, fetchIndices } from "./transaction";

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
app.post("/txs", createTx);
app.post("/txs/leaves", fetchIndices);
app.get("/txs/:alias", getTxByAccountId);
app.get("/ping", (req, resp) => {
  resp.json(utils.succ("pong"));
})

export default app;
