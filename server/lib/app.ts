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
import compression, {filter} from "compression";

const shouldCompress = (req: any, res: any) => {
    const contentType = req.getHeader("Content-Type");
    const originFilter = filter(req, res);
    return (contentType === "application/octet-stream" || contentType === "application/wasm") || originFilter;
};
app.use(compression({ filter: shouldCompress }));

app.use("/public", express.static(path.resolve(__dirname, "../../circuits"), {
  maxAge: 3600000, // set cache time to 1 hour
  etag: true // enable ETag
}));

const port = process.env.PORT || 3000;
app.listen(port, function() {
  consola.log(`Listening on port ${port}`);
});


