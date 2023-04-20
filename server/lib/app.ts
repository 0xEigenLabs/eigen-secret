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

app.use(express.static(path.resolve(__dirname, "../zkpoof")));

app.listen(3000, function() {
  consola.log("hello world!");
});

