@echo off
title AI Agent Detection Framework
echo 🤖 AI Agent Detection Framework
echo ==================================
echo.
echo Starting local web server...
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Python found, starting server...
    python server.py
) else (
    echo ❌ Python not found in PATH
    echo.
    echo Please install Python or add it to your PATH
    echo Alternatively, you can:
    echo   1. Install Python from https://python.org
    echo   2. Use any other web server
    echo   3. Open index.html directly in your browser
    echo.
    pause
)

echo.
echo Press any key to exit...
pause >nul
