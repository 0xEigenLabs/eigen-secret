#!/bin/sh
cd /eigen-secret/server/node_modules/sqlite3/ && npm i
cd /eigen-secret/server
forever ./dist/app.js
