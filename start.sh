#!/bin/bash
cd /home/z/my-project
export NODE_OPTIONS='--max-old-space-size=3072'
export PORT=3000
export HOSTNAME=0.0.0.0
export DATABASE_URL=file:/home/z/my-project/db/custom.db
exec node run-server.js
