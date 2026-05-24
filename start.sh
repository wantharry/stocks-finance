#!/usr/bin/env bash
# StockIQ — start backend + frontend
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo "=== StockIQ Market Analysis Platform ==="
echo ""

# ── Backend ───────────────────────────────────────────────────────────────
echo "[1/4] Setting up Python virtual environment..."
cd "$BACKEND"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate

echo "[2/4] Installing Python dependencies..."
pip install -q -r requirements.txt

echo "[3/4] Starting FastAPI backend on http://localhost:8080 ..."
uvicorn main:app --host 0.0.0.0 --port 8080 --reload &
BACKEND_PID=$!
echo "    Backend PID: $BACKEND_PID"

# ── Frontend ──────────────────────────────────────────────────────────────
echo "[4/4] Installing and starting React frontend..."
cd "$FRONTEND"
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run dev &
FRONTEND_PID=$!
echo "    Frontend PID: $FRONTEND_PID"

echo ""
echo "=========================================="
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo "  API Docs: http://localhost:8000/docs"
echo "=========================================="
echo ""
echo "Data refresh starts automatically on launch."
echo "Initial load of ~1000 stocks takes 10-20 minutes."
echo ""
echo "Press Ctrl+C to stop both services."

# Wait and clean up
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
