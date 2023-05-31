// app.ts
/**
 * The entry point for eigen_service
 *
 * @module main
 */

import app from "./service";
import sequlize from "./db";
import consola from "consola";
import express from "express";
import path from "path";

app.use("/public", express.static(path.resolve(__dirname, "../../circuits"), {
  maxAge: 3600000, // set cache time to 1 hour
  etag: true // enable ETag
}));

const port = process.env.PORT || 3000;
let server = app.listen(port, function() {
  consola.log(`Listening on port ${port}`);
});

process.on('SIGTERM', () => {
  consola.info('SIGTERM signal received, closing http server.');
  server.close((err) => {
    consola.log('Http server closed.');
    sequlize.close();
    process.exit(err ? 1 : 0);
  });
});

process.on('SIGINT', () => {
  consola.info('SIGINT signal received, closing http server.');
  server.close((err) => {
    consola.log('Http server closed.');
    sequlize.close();
    process.exit(err ? 1 : 0);
  });
});
