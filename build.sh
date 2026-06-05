#!/bin/bash
set -e

echo "Building React frontend..."
cd frontend
npm install
npm run build
cd ..

echo "Copying built frontend to static directory..."
rm -rf static/*
cp -r frontend/dist/* static/

echo "Build complete!"
