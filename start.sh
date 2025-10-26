#!/bin/bash

# AI Agent Detection Framework Startup Script
# Supports Python 3, Python 2, and fallback options

echo "🤖 AI Agent Detection Framework"
echo "=================================="
echo

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to find available port
find_available_port() {
    local port=8080
    while lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; do
        port=$((port + 1))
    done
    echo $port
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📁 Working directory: $SCRIPT_DIR"
echo

# Try Python 3 first
if command_exists python3; then
    echo "✅ Python 3 found, starting server..."
    python3 server.py
elif command_exists python; then
    # Check if it's Python 3
    python_version=$(python --version 2>&1)
    if [[ $python_version == *"Python 3"* ]]; then
        echo "✅ Python 3 found, starting server..."
        python server.py
    else
        echo "✅ Python 2 found, using SimpleHTTPServer..."
        PORT=$(find_available_port)
        echo "🌐 Server starting on http://localhost:$PORT"
        
        # Open browser after delay
        (sleep 2 && python -c "import webbrowser; webbrowser.open('http://localhost:$PORT')") &
        
        python -m SimpleHTTPServer $PORT
    fi
else
    echo "❌ Python not found"
    echo
    echo "Please install Python or try one of these alternatives:"
    echo
    
    # Try Node.js
    if command_exists node; then
        echo "📦 Node.js found. You can run:"
        echo "   npx http-server -p 8080"
        echo
    fi
    
    # Try PHP
    if command_exists php; then
        echo "🐘 PHP found. You can run:"
        echo "   php -S localhost:8080"
        echo
    fi
    
    # Try Ruby
    if command_exists ruby; then
        echo "💎 Ruby found. You can run:"
        echo "   ruby -run -e httpd . -p 8080"
        echo
    fi
    
    echo "Or simply open index.html in your web browser"
    echo
    
    # Try to open index.html directly
    if command_exists xdg-open; then
        echo "Opening index.html in default browser..."
        xdg-open index.html
    elif command_exists open; then
        echo "Opening index.html in default browser..."
        open index.html
    fi
    
    exit 1
fi

echo
echo "Press Ctrl+C to stop the server"
