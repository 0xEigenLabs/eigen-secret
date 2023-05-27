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
import { createAsset, getAsset, getAssetInfo } from "./asset";
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

const router = express.Router();
router.post("/accounts/create", createAccount);
router.post("/accounts/get", getAccount);
router.post("/accounts/update", updateAccount);

router.post("/transactions/create", createTx);
router.post("/transactions/get", getTxByAlias);

router.post("/statetree", updateStateTree);

router.post("/notes/get", getNotes);

router.post("/proof/create", submitProofs);
router.post("/proof/get", getProofs);

router.post("/assets/create", createAsset);
router.post("/assets/get", getAsset)
router.post("/assets/price", getAssetInfo)
app.use("/api/v1", router);

export default app;
