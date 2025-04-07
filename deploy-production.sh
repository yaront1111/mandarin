#!/bin/bash
# Production deployment script that handles CSS issues

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Starting deployment..."

# Go to project directory
cd /var/www/mandarin/client

# Install dependencies
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Installing client dependencies..."
npm install

# Run linting
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Running linting..."
npm run lint || { echo "Linting failed but continuing..."; }

# Try to build with PurgeCSS first
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Building production client bundle with PurgeCSS..."
npm run build

# If the regular build fails, try without PurgeCSS
if [ $? -ne 0 ]; then
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Regular build failed, falling back to build without PurgeCSS..."
  export DISABLE_PURGECSS=true
  npm run build
fi

# Check if build succeeded
if [ $? -eq 0 ]; then
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Client build successful."
else
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Build failed. Check logs for errors."
  exit 1
fi

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Deployment completed successfully."