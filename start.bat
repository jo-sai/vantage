@echo off
title Design Vantage Python Backend Launcher
echo ========================================================
echo 📡 Launching Design Vantage Enterprise Python Backend...
echo ========================================================

:: 1. Verify if Python is accessible on the system PATH
where python >nul 2>nul
if %errorlevel% neq 0 (
    :: Dynamic check in standard AppData local install folders
    if exist "%USERPROFILE%\AppData\Local\Programs\Python" (
        for /d %%i in ("%USERPROFILE%\AppData\Local\Programs\Python\Python*") do (
            set "PATH=%%i;%PATH%"
            goto :found_python
        )
    )
    
    echo ❌ ERROR: Python is not currently found on your system path.
    echo.
    echo To resolve this:
    echo 1. Download and install Python 3.10+ from: https://www.python.org/downloads/
    echo 2. IMPORTANT: Check the box "Add Python to PATH" during the installation process.
    echo.
    pause
    exit /b 1
)

:found_python
echo Python detected successfully:
python --version

:: 2. Setup Virtual Environment sandbox (.venv)
if exist .venv (
    .venv\Scripts\python -c "import sys" >nul 2>nul
    if errorlevel 1 (
        echo Existing virtual environment is invalid. Cleaning up...
        rmdir /s /q .venv
    )
)

if not exist .venv (
    echo Creating Python Virtual Environment...
    python -m venv .venv
)


echo 🔌 Activating Virtual Environment...
call .venv\Scripts\activate.bat

:: 3. Satisfy dependencies from requirements.txt
echo 📦 Syncing package dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt

:: 4. Start FastAPI server via Uvicorn
echo ========================================================
echo 🌐 Starting API Server on: http://localhost:4000
echo ========================================================
uvicorn app.main:app --port 4000 --reload

pause
