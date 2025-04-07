#!/bin/bash

# Temporary deployment script that uses npm install instead of npm ci

echo "=== Starting Mandarin Dating deployment (temporary) ==="
date_time=$(date +"%Y-%m-%d %H:%M:%S")
echo "[$date_time] === Starting Mandarin Dating deployment ==="

# Create backup
echo "[$date_time] Creating backup of critical files..."
mkdir -p /var/www/mandarin/backups
cp -r /var/www/mandarin/server/config.js /var/www/mandarin/backups/config.js.$(date +"%Y%m%d%H%M%S") || true
cp -r /var/www/mandarin/server/.env /var/www/mandarin/backups/.env.$(date +"%Y%m%d%H%M%S") || true

# Pull latest changes
echo "[$date_time] Pulling latest changes from GitHub..."
cd /var/www/mandarin
git pull
git_status=$?
if [ $git_status -ne 0 ]; then
  echo "[$date_time] Error pulling from repository. Exiting."
  exit 1
fi
echo "[$date_time] Repository updated to latest commit"

# Build client - using npm install instead of npm ci
echo "[$date_time] Building React client..."
cd /var/www/mandarin/client

echo "[$date_time] Installing client dependencies..."
# Use npm install instead of npm ci to avoid package-lock.json sync issues
npm install --no-audit --no-fund
install_status=$?
if [ $install_status -ne 0 ]; then
  echo "[$date_time] Error installing client dependencies. Exiting."
  exit 1
fi

echo "[$date_time] Building client application..."
npm run build
build_status=$?
if [ $build_status -ne 0 ]; then
  echo "[$date_time] Error building client application. Exiting."
  exit 1
fi
echo "[$date_time] Client build completed successfully"

# Update server
echo "[$date_time] Updating server application..."
cd /var/www/mandarin/server

echo "[$date_time] Installing server dependencies..."
# Use npm install instead of npm ci to avoid package-lock.json sync issues
npm install --no-audit --no-fund
server_install_status=$?
if [ $server_install_status -ne 0 ]; then
  echo "[$date_time] Error installing server dependencies. Exiting."
  exit 1
fi

# Restart server
echo "[$date_time] Restarting server..."
pm2 restart mandarin
if [ $? -ne 0 ]; then
  echo "[$date_time] Error restarting server. Exiting."
  exit 1
fi

# Check if server is running
sleep 3
if pm2 status | grep -q "mandarin.*online"; then
  echo "[$date_time] Server is running"
else
  echo "[$date_time] Server is NOT running. Please check logs."
fi

echo "[$date_time] === Deployment completed ==="