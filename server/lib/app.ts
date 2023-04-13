// app.ts
/**
 * The entry point for eigen_service
 *
 * @module main
 */

import app from "./service";
import consola from "consola";

app.listen(3000, function() {
  consola.log("hello world!");
});

