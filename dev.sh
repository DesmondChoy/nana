#!/bin/bash

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo "Stopping NANA services..."
    kill $BACKEND_PID
    kill $FRONTEND_PID
    exit
}

# Trap SIGINT (Ctrl+C)
trap cleanup SIGINT

echo "Starting NANA (Not Another Note App)..."

# 1. Start Backend
echo "Starting Backend (FastAPI)..."
if [ ! -f ".venv/bin/activate" ]; then
    echo "Missing Python virtualenv."
    echo "Run: uv venv && source .venv/bin/activate && uv pip install -e ."
    exit 1
fi
source .venv/bin/activate
cd backend
python -m app.main > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..
echo "Backend running on PID $BACKEND_PID"

# 2. Start Frontend
echo "Starting Frontend (Vite)..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend running on PID $FRONTEND_PID"
cd ..

# 3. Wait for services to initialize
echo "Waiting for services to spin up..."
sleep 3

# 4. Open Browser
echo "Opening Browser..."
open "http://localhost:5173"

echo "NANA is running!"
echo "Backend logs: tail -f backend.log"
echo "Frontend logs: tail -f frontend.log"
echo "Press Ctrl+C to stop."

# Keep script running to maintain locks and catch SIGINT
wait
