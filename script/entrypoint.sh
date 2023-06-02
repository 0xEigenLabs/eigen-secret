#!/bin/sh
cd /eigen-secret/server/node_modules/sqlite3/ && npm i
# for ngx cache
mkdir -p /mnt/data
cd /eigen-secret/server
forever ./dist/app.js
