#!/bin/bash
# Keep-alive script for the Next.js dev server
# Uses setsid + nohup to survive shell session termination
# Restarts the server whenever it dies
cd /home/z/my-project
export NODE_OPTIONS='--max-old-space-size=4096'

while true; do
  echo "[$(date)] Starting Next.js dev server..."
  npx next dev --webpack -p 3000
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE. Restarting in 3 seconds..."
  sleep 3
done
