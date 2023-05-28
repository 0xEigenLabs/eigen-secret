#!/bin/sh

cd /app/eigen-secret/server/node_modules/sqlite3/ && npm i
cd /app/eigen-secret/server
forever ./dist/app.js

