#!/bin/bash

echo "🖥️  Monitor Controller Tauri Setup"
echo "=================================="

# Check if Rust is installed
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust not found. Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

# Check if m1ddc is installed
if ! command -v m1ddc &> /dev/null; then
    echo "❌ m1ddc not found. Installing via Homebrew..."
    brew install m1ddc
fi

echo "✅ Dependencies checked"

# Install npm dependencies
echo "📦 Installing npm dependencies..."
cd ~/Pdev/monitor-tauri/monitor-ui
npm install
npm install @tauri-apps/api

# Fix common issues
echo "🔧 Ensuring required files are in place..."
mkdir -p src-tauri/.cargo
mkdir -p src-tauri/icons

# Build and run the app
echo "🚀 Building and running the app..."
npm run tauri dev

echo ""
echo "✅ Setup complete!"
echo ""