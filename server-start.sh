#!/bin/bash
cd /home/z/my-project
while true; do
  npx next dev -p 3000 >> dev.log 2>&1
  echo "Server crashed at $(date), restarting in 5s..." >> dev.log
  sleep 5
done
