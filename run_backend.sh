#!/usr/bin/env bash
# Kill anything on port 8000 then restart uvicorn
fuser -k 8080/tcp 2>/dev/null || true
sleep 1
cd /home/openclaw/projects/finance/backend
source .venv/bin/activate
exec uvicorn main:app --host 0.0.0.0 --port 8080
