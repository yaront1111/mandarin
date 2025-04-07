#!/bin/bash
# Safe deployment script that skips PurgeCSS to avoid CSS selector issues

# Go to project directory
cd /Users/yarontorgeman/mandarin/client

# Install dependencies
npm install

# Run linting
npm run lint

# Build without PurgeCSS
DISABLE_PURGECSS=true npm run build

echo "Build completed successfully without PurgeCSS"