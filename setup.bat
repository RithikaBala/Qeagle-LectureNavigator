@echo off
echo =====================================
echo    Lecture Navigator Setup Script
echo =====================================

REM Step 1: Check Python
python --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo  Python is not installed. Please install Python 3.10 or later.
    pause
    exit /b
)
echo  Python found.

REM Step 2: Backend Setup
echo -------------------------------------
echo Setting up Backend (FastAPI + Whisper)
echo -------------------------------------
cd backend

IF NOT EXIST .venv (
    echo Creating virtual environment...
    python -m venv .venv
)

echo Activating virtual environment...
call .venv\Scripts\activate

echo Installing backend dependencies...
pip install --upgrade pip
pip install -r requirements.txt

echo Backend setup complete!
cd ..

REM Step 3: Frontend Setup
echo -------------------------------------
echo Setting up Frontend (React + Tailwind)
echo -------------------------------------
cd frontend

IF EXIST node_modules (
    echo Node modules already installed.
) ELSE (
    echo Installing frontend dependencies...
    npm install
)

cd ..

echo -------------------------------------
echo  Setup Complete!
echo To start backend: 
echo    cd backend && call .venv\Scripts\activate && uvicorn main:app --reload --port 8000
echo.
echo To start frontend:
echo    cd frontend && npm start
echo -------------------------------------

pause
