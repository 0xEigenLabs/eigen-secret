// app.ts
/**
 * The entry point for eigen_service
 *
 * @module main
 */

import app from "./service";
import consola from "consola";
import express from "express";
import path from "path";

app.use("/public", express.static(path.resolve(__dirname, "../../circuits"), {
  maxAge: 3600000, // set cache time to 1 hour
  etag: true // enable ETag
}));

app.listen(3000, function() {
  consola.log("hello world!");
});

