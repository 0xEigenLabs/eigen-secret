#!/bin/sh
(
    cd /app/eigen-secret/server/node_modules/sqlite3/ && npm i
)

forever ./server/dist/app.js

