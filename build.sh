#!/bin/bash
set -e

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Building React frontend..."
cd frontend
npm install
npm run build -- --base=/static/
cd ..

echo "Copying built frontend to static directory..."
rm -rf static/*
cp -r frontend/dist/* static/

echo "Build complete!"