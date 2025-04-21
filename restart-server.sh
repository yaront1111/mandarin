#!/bin/bash
# Server Restart Script
# This script correctly restarts the server as www-data user

# Exit immediately on error
set -e

# Configuration Variables
APP_DIR="/var/www/mandarin"
SERVER_DIR="$APP_DIR/server"
PM2_APP_NAME="flirtss-server"
LOG_FILE="/var/log/mandarin-restart.log"

# Function for logging
log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

# Create log directory if it doesn't exist
mkdir -p $(dirname "$LOG_FILE")
touch "$LOG_FILE"

log "Starting server restart process..."

# Check if we're running with sufficient permissions
if [ "$EUID" -ne 0 ]; then
    log "WARNING: This script is not running as root. Some operations may fail."
    log "Consider running with sudo."
fi

# Make sure www-data user exists
if ! id "www-data" &>/dev/null; then
    log "ERROR: www-data user not found. Cannot proceed."
    exit 1
fi

# Make sure the server directory is owned by www-data
log "Setting proper ownership for server directory..."
chown -R www-data:www-data "$SERVER_DIR"

# Stop any existing instances of the app
log "Stopping any existing PM2 instances..."
if sudo -u www-data pm2 list | grep -q "$PM2_APP_NAME"; then
    sudo -u www-data pm2 stop "$PM2_APP_NAME" || log "WARNING: Failed to stop PM2 process"
    sudo -u www-data pm2 delete "$PM2_APP_NAME" || log "WARNING: Failed to delete PM2 process"
fi

# Start the server with PM2 as www-data
log "Starting server with PM2 as www-data..."
cd "$SERVER_DIR"
sudo -u www-data pm2 start server.js --name "$PM2_APP_NAME" --time || {
    log "ERROR: Failed to start server. Check logs for details."
    exit 1
}

# Save PM2 configuration to survive system restarts
sudo -u www-data pm2 save || log "WARNING: Failed to save PM2 configuration"

# Setup PM2 to start on system boot if not already configured
sudo -u www-data pm2 startup || log "WARNING: Could not configure PM2 startup. Manual configuration may be required."

# Restart Nginx to ensure it can communicate with the Node.js server
log "Restarting Nginx..."
systemctl restart nginx || {
    log "ERROR: Failed to restart Nginx. Check Nginx logs for details."
    exit 1
}

log "Server restart process completed successfully."
echo ""
echo "==========================================================="
echo "Server restarted successfully as www-data user."
echo "PM2 process name: $PM2_APP_NAME"
echo "Nginx has been restarted."
echo "==========================================================="